-- 0015: synced blocks (Appendix A, Part 1) — one identity, many placements.
--
-- A synced block's content lives in its own collaborative document, held
-- here (`ydoc`, with `blocks` as the queryable projection) and synced live
-- through a Liveblocks room `synced:{id}`. Every placement, the source
-- page's included, is an editor block of type `syncedBlock` carrying only
-- the reference (`syncedBlockId`, `readOnly`). Permission to read or edit
-- a synced block is permission to read or edit its *source page*; a user
-- who cannot see the source page gets no row, and the editor renders a
-- neutral placeholder. `source_page_id` null is a tombstone.

create table public.synced_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_page_id uuid references public.pages (id) on delete set null,
  title text not null default '',
  -- Stable key for template instantiation: an embed in a page template
  -- resolves to the synced block with the same key in the target workspace.
  template_key text,
  ydoc bytea,
  blocks jsonb not null default '[]'::jsonb,
  search_text text,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint synced_blocks_title_length check (char_length(title) <= 200),
  constraint synced_blocks_blocks_shape check (jsonb_typeof(blocks) = 'array')
);

create unique index synced_blocks_template_key_idx
  on public.synced_blocks (workspace_id, template_key)
  where template_key is not null;
create index synced_blocks_source_idx on public.synced_blocks (source_page_id);

-- Placements, refreshed from the host page's blocks projection on every
-- save: answers "where does this appear?" and drives placement counts and
-- backlinks. `block_id` is the placement block's editor id.
create table public.synced_embeds (
  block_id text primary key,
  synced_block_id uuid not null references public.synced_blocks (id) on delete cascade,
  host_page_id uuid not null references public.pages (id) on delete cascade,
  read_only boolean not null default false
);

create index synced_embeds_synced_idx on public.synced_embeds (synced_block_id);
create index synced_embeds_host_idx on public.synced_embeds (host_page_id);

alter table public.synced_blocks enable row level security;
alter table public.synced_embeds enable row level security;

-- Visible when the source page is (pages RLS: member, and not someone
-- else's private page). Tombstones stay visible to workspace members so
-- placements can say what was lost.
create policy synced_blocks_select on public.synced_blocks
  for select using (
    (source_page_id is not null
      and exists (select 1 from public.pages p where p.id = source_page_id))
    or (source_page_id is null and public.is_workspace_member(workspace_id))
  );
create policy synced_blocks_insert on public.synced_blocks
  for insert with check (
    created_by = (select auth.uid())
    and source_page_id is not null
    and public.can_edit_page(source_page_id)
  );
create policy synced_blocks_update on public.synced_blocks
  for update
  using (source_page_id is not null and public.can_edit_page(source_page_id))
  with check (source_page_id is not null and public.can_edit_page(source_page_id));
create policy synced_blocks_delete on public.synced_blocks
  for delete using (
    (source_page_id is not null and public.can_edit_page(source_page_id))
    or public.workspace_role_at_least(workspace_id, 'owner')
  );

create policy synced_embeds_select on public.synced_embeds
  for select using (
    exists (select 1 from public.pages p where p.id = host_page_id)
  );
create policy synced_embeds_write on public.synced_embeds
  for all using (public.can_edit_page(host_page_id))
  with check (public.can_edit_page(host_page_id));

-- ---------------------------------------------------------------------
-- Search text for a page: its own block text plus the text of synced
-- blocks whose source it is — content indexes once, under the source
-- page (brief §1.3 rule 10). Placements contribute nothing.
-- ---------------------------------------------------------------------
create function public.page_search_text(p_page_id uuid)
returns text
language sql stable
set search_path = public
as $$
  select left(
    coalesce((
      select string_agg(v #>> '{}', ' ')
      from public.blocks b, jsonb_path_query(b.content, 'lax $.**.text') as v
      where b.page_id = p_page_id and jsonb_typeof(v) = 'string'
    ), '')
    || ' ' ||
    coalesce((
      select string_agg(coalesce(s.search_text, ''), ' ')
      from public.synced_blocks s
      where s.source_page_id = p_page_id and s.deleted_at is null
    ), ''),
    200000
  );
$$;

create or replace function public.replace_page_blocks(p_page_id uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a json array';
  end if;

  delete from public.blocks where page_id = p_page_id;

  insert into public.blocks (id, page_id, parent_block_id, type, position, content, created_by)
  select
    b ->> 'id',
    p_page_id,
    b ->> 'parent_block_id',
    b ->> 'type',
    b ->> 'position',
    coalesce(b -> 'content', '{}'::jsonb),
    auth.uid()
  from jsonb_array_elements(p_blocks) as b;

  -- Placements of synced blocks on this page.
  delete from public.synced_embeds where host_page_id = p_page_id;
  insert into public.synced_embeds (block_id, synced_block_id, host_page_id, read_only)
  select
    b ->> 'id',
    (b #>> '{content,props,syncedBlockId}')::uuid,
    p_page_id,
    coalesce((b #>> '{content,props,readOnly}')::boolean, false)
  from jsonb_array_elements(p_blocks) as b
  where b ->> 'type' = 'syncedBlock'
    and (b #>> '{content,props,syncedBlockId}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.synced_blocks s
      where s.id = (b #>> '{content,props,syncedBlockId}')::uuid
    )
  on conflict (block_id) do nothing;

  update public.pages
  set updated_at = now(), search_text = public.page_search_text(p_page_id)
  where id = p_page_id;

  if not found then
    raise exception 'page not found or not editable';
  end if;
end;
$$;

-- Backlinks also cover synced content: a host page "links to" the source
-- page of every synced block it embeds (brief §1.3 rule 10).
create or replace function public.set_page_links(
  p_source_page_id uuid,
  p_target_page_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not public.can_edit_page(p_source_page_id) then
    raise exception 'not allowed';
  end if;

  delete from public.page_links where source_page_id = p_source_page_id;

  insert into public.page_links (source_page_id, target_page_id)
  select distinct p_source_page_id, t
  from unnest(p_target_page_ids) as t
  where t <> p_source_page_id
    and exists (select 1 from public.pages p where p.id = t and p.deleted_at is null)
  on conflict do nothing;

  insert into public.page_links (source_page_id, target_page_id)
  select distinct p_source_page_id, s.source_page_id
  from public.synced_embeds e
  join public.synced_blocks s on s.id = e.synced_block_id
  where e.host_page_id = p_source_page_id
    and s.source_page_id is not null
    and s.source_page_id <> p_source_page_id
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Lifecycle.
-- ---------------------------------------------------------------------

-- Turn content into a synced block: the row is created from the blocks
-- being lifted out of the source page; the caller then replaces them in
-- the page with a placement. The collaborative document is seeded from
-- `blocks` by the first editor that opens its room.
create function public.create_synced_block(
  p_source_page_id uuid,
  p_title text,
  p_blocks jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_workspace uuid;
  v_id uuid;
  v_text text;
begin
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a json array';
  end if;
  select workspace_id into v_workspace
  from public.pages where id = p_source_page_id and deleted_at is null;
  if v_workspace is null then
    raise exception 'source page not found';
  end if;

  select left(string_agg(v #>> '{}', ' '), 200000) into v_text
  from jsonb_path_query(p_blocks, 'lax $.**.text') as v
  where jsonb_typeof(v) = 'string';

  insert into public.synced_blocks
    (workspace_id, source_page_id, title, blocks, search_text, created_by)
  values
    (v_workspace, p_source_page_id, left(coalesce(p_title, ''), 200), p_blocks, v_text, auth.uid())
  returning id into v_id;

  update public.pages
  set search_text = public.page_search_text(p_source_page_id)
  where id = p_source_page_id;

  return v_id;
end;
$$;

-- Persist an edit made through any placement. Permission is the source
-- page's (RLS on the update). Audit records where the change lives and
-- where the actor was, coalesced to one event per actor per block per
-- five minutes.
create function public.save_synced_block(
  p_id uuid,
  p_ydoc_base64 text,
  p_blocks jsonb,
  p_host_page_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_source uuid;
  v_workspace uuid;
  v_text text;
begin
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a json array';
  end if;

  select left(string_agg(v #>> '{}', ' '), 200000) into v_text
  from jsonb_path_query(p_blocks, 'lax $.**.text') as v
  where jsonb_typeof(v) = 'string';

  update public.synced_blocks
  set ydoc = decode(p_ydoc_base64, 'base64'),
      blocks = p_blocks,
      search_text = v_text,
      updated_at = now()
  where id = p_id and deleted_at is null
  returning source_page_id, workspace_id into v_source, v_workspace;

  if v_source is null then
    raise exception 'synced block not found or not editable';
  end if;

  update public.pages
  set search_text = public.page_search_text(v_source)
  where id = v_source;

  if not exists (
    select 1 from public.audit_events
    where actor_id = auth.uid()
      and event_type = 'synced_block_edited'
      and target_id = p_id
      and created_at > now() - interval '5 minutes'
  ) then
    insert into public.audit_events
      (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      auth.uid(), v_workspace, 'synced_block_edited', 'synced_block', p_id,
      jsonb_build_object('source_page_id', v_source, 'host_page_id', p_host_page_id)
    );
  end if;
end;
$$;

-- Everything a placement needs to render: null when the caller cannot
-- see the source page (the editor shows a neutral placeholder and never
-- learns the title).
create function public.load_synced_block(p_id uuid)
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

-- For the insert picker: synced blocks the caller can see in a workspace.
create function public.list_synced_blocks(p_workspace_id uuid)
returns table (
  id uuid,
  title text,
  source_page_id uuid,
  source_title text,
  source_icon text,
  placements bigint,
  updated_at timestamptz
)
language sql stable
set search_path = public
as $$
  select
    s.id, s.title, s.source_page_id, p.title, p.icon,
    (select count(distinct e.host_page_id) from public.synced_embeds e where e.synced_block_id = s.id),
    s.updated_at
  from public.synced_blocks s
  join public.pages p on p.id = s.source_page_id
  where s.workspace_id = p_workspace_id
    and s.deleted_at is null
    and p.deleted_at is null
  order by s.updated_at desc
  limit 200;
$$;

revoke execute on function public.create_synced_block(uuid, text, jsonb) from public, anon;
revoke execute on function public.save_synced_block(uuid, text, jsonb, uuid) from public, anon;
revoke execute on function public.load_synced_block(uuid) from public, anon;
revoke execute on function public.list_synced_blocks(uuid) from public, anon;

-- rollback:
--   drop function if exists public.list_synced_blocks(uuid);
--   drop function if exists public.load_synced_block(uuid);
--   drop function if exists public.save_synced_block(uuid, text, jsonb, uuid);
--   drop function if exists public.create_synced_block(uuid, text, jsonb);
--   (restore public.set_page_links and public.replace_page_blocks from 0009)
--   drop function if exists public.page_search_text(uuid);
--   drop policy if exists synced_embeds_write on public.synced_embeds;
--   drop policy if exists synced_embeds_select on public.synced_embeds;
--   drop policy if exists synced_blocks_delete on public.synced_blocks;
--   drop policy if exists synced_blocks_update on public.synced_blocks;
--   drop policy if exists synced_blocks_insert on public.synced_blocks;
--   drop policy if exists synced_blocks_select on public.synced_blocks;
--   drop table if exists public.synced_embeds;
--   drop table if exists public.synced_blocks;
