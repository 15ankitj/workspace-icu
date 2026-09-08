-- 0021: block-level suggestions (Appendix A, Part 2, slice 3).
--
-- Whole-block insertions, deletions and moves are node-level marks in
-- the document; nothing changes in storage for them. This file adds the
-- two things around them: the "context changed" state — a suggestion
-- whose underlying text an author removed becomes `stale`, is reported
-- to the suggester, and can only be withdrawn or dismissed (§2.4) — and
-- suggest mode inside placements of synced blocks whose source page is
-- authored content (§2.5), with the same server-side enforcement as
-- pages.

alter table public.page_suggestions drop constraint page_suggestions_status;
alter table public.page_suggestions add constraint page_suggestions_status
  check (status in ('open', 'accepted', 'rejected', 'withdrawn', 'stale'));

alter table public.notifications drop constraint notifications_kind;
alter table public.notifications add constraint notifications_kind
  check (kind in (
    'suggestion_created', 'suggestion_accepted', 'suggestion_rejected',
    'suggestion_withdrawn', 'suggestion_reply', 'suggestion_stale'
  ));

-- An editor of the page reports suggestions whose marks are gone from
-- the document (their own edit removed the context). Never auto-applied.
create function public.mark_suggestions_stale(p_page_id uuid, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row public.page_suggestions%rowtype;
  v_ws uuid;
begin
  if not public.can_edit_page(p_page_id) then
    raise exception 'not allowed';
  end if;
  select workspace_id into v_ws from public.pages where id = p_page_id;
  for v_row in
    update public.page_suggestions
    set status = 'stale', resolved_at = now(), resolved_by = auth.uid()
    where page_id = p_page_id and id = any (coalesce(p_ids, '{}')) and status = 'open'
    returning *
  loop
    v_count := v_count + 1;
    insert into public.audit_events
      (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      auth.uid(), v_ws, 'suggestion_stale', 'page', p_page_id,
      jsonb_build_object('suggestion_id', v_row.id, 'suggester_id', v_row.suggester_id)
    );
  end loop;
  return v_count;
end;
$$;

-- Stale suggestions notify the suggester too.
create or replace function public.notify_suggestion_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.pages where id = new.page_id;
  if tg_op = 'INSERT' then
    perform public.notify_users(
      public.page_authors(new.page_id), v_ws, new.page_id, new.id,
      'suggestion_created', new.suggester_id
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'open' then
    if new.status = 'withdrawn' then
      perform public.notify_users(
        public.page_authors(new.page_id), v_ws, new.page_id, new.id,
        'suggestion_withdrawn', new.suggester_id
      );
    else
      perform public.notify_users(
        array[new.suggester_id], v_ws, new.page_id, new.id,
        'suggestion_' || new.status, new.resolved_by
      );
    end if;
  end if;
  return new;
end;
$$;

-- A stale suggestion can be withdrawn by the suggester or dismissed
-- (rejected) by an author; it can never be accepted.
create or replace function public.resolve_suggestion(
  p_page_id uuid,
  p_id text,
  p_outcome text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.page_suggestions%rowtype;
  v_page public.pages%rowtype;
  v_override boolean := false;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_outcome not in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'unknown outcome';
  end if;
  select * into v_row from public.page_suggestions
  where page_id = p_page_id and id = p_id;
  if v_row.page_id is null then
    raise exception 'suggestion not found';
  end if;
  if v_row.status not in ('open', 'stale') then
    raise exception 'suggestion already %', v_row.status;
  end if;
  if v_row.status = 'stale' and p_outcome = 'accepted' then
    raise exception 'context changed: this suggestion can no longer be applied';
  end if;
  select * into v_page from public.pages where id = p_page_id;

  if p_outcome = 'withdrawn' then
    if v_row.suggester_id <> auth.uid() then
      raise exception 'only the suggester can withdraw a suggestion';
    end if;
  elsif public.page_is_author(p_page_id) then
    v_override := false;
  elsif public.workspace_role_at_least(v_page.workspace_id, 'owner') then
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'a workspace owner resolving another author''s page must give a reason';
    end if;
    v_override := true;
  else
    raise exception 'only the page author can resolve suggestions';
  end if;

  update public.page_suggestions
  set status = p_outcome,
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_reason = case when v_override then v_reason else null end,
      owner_override = v_override
  where page_id = p_page_id and id = p_id;

  insert into public.audit_events
    (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (
    auth.uid(), v_page.workspace_id, 'suggestion_' || p_outcome, 'page', p_page_id,
    jsonb_build_object(
      'suggestion_id', p_id,
      'suggester_id', v_row.suggester_id,
      'resolved_by', auth.uid(),
      'owner_override', v_override,
      'reason', case when v_override then v_reason else null end
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Synced blocks from authored pages: suggest inside placements (§2.5).
-- Canonical form of a nested document: block types and text in order.
-- ---------------------------------------------------------------------
create function public.nested_blocks_text(p_blocks jsonb)
returns text
language sql stable
set search_path = public
as $$
  select coalesce(string_agg(
    case
      when v ->> 'type' = 'text' then v ->> 'text'
      when v ? 'type' and not (v ? 'text') and (v ? 'content' or v ? 'children' or v ? 'props')
        then E'\n' || (v ->> 'type') || ':'
      else ''
    end, ''
  ), '')
  from jsonb_path_query(coalesce(p_blocks, '[]'::jsonb), 'strict $.**') as v
  where jsonb_typeof(v) = 'object';
$$;

create function public.assert_authored_synced_edit(p_id uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_source uuid;
  v_ws uuid;
  v_stored jsonb;
begin
  select s.source_page_id, s.workspace_id, s.blocks into v_source, v_ws, v_stored
  from public.synced_blocks s join public.pages p on p.id = s.source_page_id
  where s.id = p_id and p.authored_content;
  if v_source is null then
    return;
  end if;
  if public.page_is_author(v_source) then
    return;
  end if;
  if public.workspace_role_at_least(v_ws, 'owner') and exists (
    select 1 from public.page_suggestions s
    where s.page_id = v_source
      and s.resolved_by = auth.uid()
      and s.resolved_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  if public.nested_blocks_text(p_blocks) is distinct from public.nested_blocks_text(v_stored) then
    raise exception 'authored_content: only the source page''s author can change this synced block — suggest instead';
  end if;
end;
$$;

create or replace function public.save_synced_block(
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

  perform public.assert_authored_synced_edit(p_id, p_blocks);

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

-- The placement learns whether this user is the source's author, and
-- whether they may suggest there. `can_edit` stays: direct editing.
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
    'source_authored', coalesce(p.authored_content, false),
    'source_is_author', s.source_page_id is not null and public.page_is_author(p.id),
    'tombstone', s.source_page_id is null or s.deleted_at is not null,
    'deleted_at', s.deleted_at,
    'can_edit', s.source_page_id is not null
      and p.deleted_at is null
      and s.deleted_at is null
      and public.can_edit_page(s.source_page_id)
      and (not p.authored_content or public.page_is_author(p.id)),
    'can_suggest', s.source_page_id is not null
      and p.deleted_at is null
      and s.deleted_at is null
      and coalesce(p.authored_content, false)
      and public.can_edit_page(s.source_page_id)
      and not public.page_is_author(p.id),
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

revoke execute on function public.mark_suggestions_stale(uuid, text[]) from public, anon;
revoke execute on function public.assert_authored_synced_edit(uuid, jsonb) from public, anon;

-- rollback:
--   (restore public.load_synced_block, public.save_synced_block from 0018)
--   drop function if exists public.assert_authored_synced_edit(uuid, jsonb);
--   drop function if exists public.nested_blocks_text(jsonb);
--   (restore public.resolve_suggestion from 0018 and public.notify_suggestion_change from 0020)
--   drop function if exists public.mark_suggestions_stale(uuid, text[]);
--   alter table public.notifications drop constraint notifications_kind;
--   alter table public.notifications add constraint notifications_kind check (kind in ('suggestion_created','suggestion_accepted','suggestion_rejected','suggestion_withdrawn','suggestion_reply'));
--   alter table public.page_suggestions drop constraint page_suggestions_status;
--   alter table public.page_suggestions add constraint page_suggestions_status check (status in ('open','accepted','rejected','withdrawn'));
