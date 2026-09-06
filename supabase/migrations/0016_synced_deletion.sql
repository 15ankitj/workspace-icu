-- 0016: synced blocks — deletion, new source, tombstones (Appendix A,
-- Part 1, rules 6 and 7).
--
-- Deleting a placement removes only that placement (editor-side). Deleting
-- the *source* placement prompts: delete everywhere, or choose a new
-- source. "Delete everywhere" tombstones the synced block: content is
-- cleared, the title and time are kept so every remaining placement can
-- say what was lost and when. A page purge — from the Trash with the
-- actor present (who is prompted first), or by the nightly job — tombstones
-- whatever still has that page as its source, through a trigger, so no
-- placement is ever silently orphaned. Tombstones with no placements left
-- are removed 30 days later.

alter table public.synced_blocks
  add column content_purged_at timestamptz;

comment on column public.synced_blocks.content_purged_at is
  'When the collaborative room of a tombstoned block was deleted upstream.';

-- ---------------------------------------------------------------------
-- Tombstoning. The title survives unless the source page was private
-- (nobody else was ever meant to learn it); content does not.
-- ---------------------------------------------------------------------
create function public.synced_block_tombstone(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_private boolean;
begin
  select coalesce(p.is_private, false) into v_private
  from public.synced_blocks s
  left join public.pages p on p.id = s.source_page_id
  where s.id = p_id;

  update public.synced_blocks
  set deleted_at = now(),
      source_page_id = null,
      ydoc = null,
      blocks = '[]'::jsonb,
      search_text = null,
      title = case when v_private then '' else title end,
      updated_at = now()
  where id = p_id and deleted_at is null;
end;
$$;

revoke execute on function public.synced_block_tombstone(uuid) from public, anon, authenticated;

-- A page that is removed for good takes its synced sources to tombstones,
-- whoever removes it (Trash purge, nightly job, account deletion).
create function public.pages_tombstone_synced_sources()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.synced_blocks
    where source_page_id = old.id and deleted_at is null
  loop
    perform public.synced_block_tombstone(v_id);
  end loop;
  return old;
end;
$$;

create trigger pages_tombstone_synced_sources
  before delete on public.pages
  for each row execute function public.pages_tombstone_synced_sources();

-- ---------------------------------------------------------------------
-- "Delete everywhere" (rule 6). Same permission as the delete policy:
-- an editor of the source page, or a workspace owner.
-- ---------------------------------------------------------------------
create function public.delete_synced_block(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.synced_blocks%rowtype;
  v_placements bigint;
begin
  select * into v_row from public.synced_blocks where id = p_id;
  if v_row.id is null or v_row.deleted_at is not null then
    raise exception 'synced block not found';
  end if;
  if not (
    (v_row.source_page_id is not null and public.can_edit_page(v_row.source_page_id))
    or public.workspace_role_at_least(v_row.workspace_id, 'owner')
  ) then
    raise exception 'not allowed to delete this synced block';
  end if;

  select count(distinct host_page_id) into v_placements
  from public.synced_embeds where synced_block_id = p_id;

  perform public.synced_block_tombstone(p_id);

  if v_row.source_page_id is not null then
    update public.pages
    set search_text = public.page_search_text(v_row.source_page_id)
    where id = v_row.source_page_id;
  end if;

  insert into public.audit_events
    (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (
    auth.uid(), v_row.workspace_id, 'synced_block_deleted', 'synced_block', p_id,
    jsonb_build_object('source_page_id', v_row.source_page_id, 'placements', v_placements)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- "Choose a new source" (rules 6, 7): a page that already hosts a
-- placement becomes the source. Permission: may edit the old source page
-- (its trash state ignored, so this works from the Trash) and the new one.
-- ---------------------------------------------------------------------
create function public.reassign_synced_source(p_id uuid, p_new_source_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.synced_blocks%rowtype;
  v_old public.pages%rowtype;
  v_new public.pages%rowtype;
begin
  select * into v_row from public.synced_blocks where id = p_id;
  if v_row.id is null or v_row.deleted_at is not null or v_row.source_page_id is null then
    raise exception 'synced block not found';
  end if;
  select * into v_old from public.pages where id = v_row.source_page_id;
  select * into v_new from public.pages where id = p_new_source_page_id;

  if v_old.id is null
    or not public.workspace_role_at_least(v_old.workspace_id, 'editor')
    or (v_old.is_private and v_old.created_by is distinct from auth.uid()) then
    raise exception 'not allowed to change the source of this synced block';
  end if;
  if v_new.id is null or v_new.workspace_id <> v_row.workspace_id
    or v_new.deleted_at is not null or not public.can_edit_page(v_new.id) then
    raise exception 'the new source page is not editable';
  end if;
  if v_new.id = v_old.id then
    return;
  end if;
  if not exists (
    select 1 from public.synced_embeds
    where synced_block_id = p_id and host_page_id = v_new.id
  ) then
    raise exception 'the new source page does not hold a placement of this block';
  end if;

  update public.synced_blocks
  set source_page_id = v_new.id
  where id = p_id;

  update public.pages
  set search_text = public.page_search_text(id)
  where id in (v_old.id, v_new.id);

  insert into public.audit_events
    (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (
    auth.uid(), v_row.workspace_id, 'synced_source_changed', 'synced_block', p_id,
    jsonb_build_object('from_page_id', v_old.id, 'to_page_id', v_new.id)
  );
end;
$$;

-- Pages hosting a placement of a synced block that the caller can see
-- (pages RLS applies), for the "choose a new source" picker. The source
-- page itself is excluded; trashed hosts too.
create function public.list_synced_hosts(p_id uuid)
returns table (
  page_id uuid,
  title text,
  icon text,
  is_private boolean
)
language sql stable
set search_path = public
as $$
  select distinct on (p.id) p.id, p.title, p.icon, p.is_private
  from public.synced_embeds e
  join public.pages p on p.id = e.host_page_id
  join public.synced_blocks s on s.id = e.synced_block_id
  where e.synced_block_id = p_id
    and p.deleted_at is null
    and p.id is distinct from s.source_page_id
  order by p.id;
$$;

-- Before purging pages: synced blocks whose source is one of them and
-- which still appear on pages outside the set, with the hosts the caller
-- can see. Drives the purge-time prompt (rule 7).
create function public.synced_sources_at_risk(p_page_ids uuid[])
returns table (
  id uuid,
  title text,
  source_page_id uuid,
  placements bigint,
  hosts jsonb
)
language sql stable
set search_path = public
as $$
  select
    s.id, s.title, s.source_page_id,
    (select count(distinct e.host_page_id) from public.synced_embeds e
      where e.synced_block_id = s.id and e.host_page_id <> all (p_page_ids)),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'icon', p.icon, 'is_private', p.is_private
      ) order by p.title)
      from (
        select distinct e.host_page_id from public.synced_embeds e
        where e.synced_block_id = s.id and e.host_page_id <> all (p_page_ids)
      ) h
      join public.pages p on p.id = h.host_page_id
      where p.deleted_at is null
    ), '[]'::jsonb)
  from public.synced_blocks s
  where s.source_page_id = any (p_page_ids)
    and s.deleted_at is null
    and exists (
      select 1 from public.synced_embeds e
      where e.synced_block_id = s.id and e.host_page_id <> all (p_page_ids)
    );
$$;

-- Nightly: tombstones nobody places any more, 30 days on. Service role
-- only (the job runs across workspaces).
create function public.purge_synced_tombstones(p_cutoff timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with gone as (
    delete from public.synced_blocks s
    where s.deleted_at is not null
      and s.deleted_at < p_cutoff
      and not exists (
        select 1 from public.synced_embeds e where e.synced_block_id = s.id
      )
    returning s.id
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

revoke execute on function public.purge_synced_tombstones(timestamptz) from public, anon, authenticated;

-- load_synced_block also reports when a tombstone was made.
create or replace function public.load_synced_block(p_id uuid)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'workspace_id', s.workspace_id,
    'title', s.title,
    'source_page_id', s.source_page_id,
    'source_title', p.title,
    'source_icon', p.icon,
    'source_deleted', p.deleted_at is not null,
    'tombstone', s.source_page_id is null or s.deleted_at is not null,
    'deleted_at', s.deleted_at,
    'can_edit', s.source_page_id is not null
      and p.deleted_at is null
      and s.deleted_at is null
      and public.can_edit_page(s.source_page_id),
    'ydoc', encode(s.ydoc, 'base64'),
    'blocks', s.blocks,
    'placements', (
      select count(distinct e.host_page_id)
      from public.synced_embeds e where e.synced_block_id = s.id
    ),
    'updated_at', s.updated_at
  )
  from public.synced_blocks s
  left join public.pages p on p.id = s.source_page_id
  where s.id = p_id;
$$;

revoke execute on function public.delete_synced_block(uuid) from public, anon;
revoke execute on function public.reassign_synced_source(uuid, uuid) from public, anon;
revoke execute on function public.list_synced_hosts(uuid) from public, anon;
revoke execute on function public.synced_sources_at_risk(uuid[]) from public, anon;

-- rollback:
--   drop function if exists public.purge_synced_tombstones(timestamptz);
--   drop function if exists public.synced_sources_at_risk(uuid[]);
--   drop function if exists public.list_synced_hosts(uuid);
--   drop function if exists public.reassign_synced_source(uuid, uuid);
--   drop function if exists public.delete_synced_block(uuid);
--   drop trigger if exists pages_tombstone_synced_sources on public.pages;
--   drop function if exists public.pages_tombstone_synced_sources();
--   drop function if exists public.synced_block_tombstone(uuid);
--   (restore public.load_synced_block from 0015)
--   alter table public.synced_blocks drop column if exists content_purged_at;
