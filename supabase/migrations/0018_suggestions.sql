-- 0018: suggestion mode (Appendix A, Part 2, slice 1).
--
-- Suggestions live as marks inside the page's collaborative document
-- (insertion / deletion / modification, each carrying a suggestion id
-- whose prefix is the suggester's user id). `blocks` is the *clean*
-- projection: what the page says with every open suggestion reverted.
-- This file adds: the authored-content flag and co-authors on pages, an
-- index of suggestions for lifecycle and audit, and the server-side
-- enforcement — on an authored page a non-author's save must leave the
-- clean text and block types exactly as they are (brief §2.2).

alter table public.pages
  add column authored_content boolean not null default false,
  add column co_authors uuid[] not null default '{}';

comment on column public.pages.authored_content is
  'Non-authors suggest instead of edit; the server refuses their direct changes.';

-- The page creator, or anyone the creator named as co-author.
create function public.page_is_author(p_page_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pages p
    where p.id = p_page_id
      and (p.created_by = auth.uid() or auth.uid() = any (p.co_authors))
  );
$$;

-- Only authors and workspace owners may change authorship settings,
-- whichever path the update takes.
create function public.pages_guard_authorship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.authored_content is distinct from old.authored_content
      or new.co_authors is distinct from old.co_authors)
    and not (
      old.created_by = auth.uid()
      or auth.uid() = any (old.co_authors)
      or public.workspace_role_at_least(old.workspace_id, 'owner')
    ) then
    raise exception 'only the page author or a workspace owner can change authorship';
  end if;
  return new;
end;
$$;

create trigger pages_guard_authorship
  before update of authored_content, co_authors on public.pages
  for each row execute function public.pages_guard_authorship();

create function public.set_page_authorship(
  p_page_id uuid,
  p_authored boolean,
  p_co_authors uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_page public.pages%rowtype;
  v_co uuid[];
begin
  select * into v_page from public.pages where id = p_page_id and deleted_at is null;
  if v_page.id is null then
    raise exception 'page not found';
  end if;
  -- Co-authors must be members; the creator is an author already.
  select coalesce(array_agg(distinct m.user_id), '{}') into v_co
  from public.workspace_members m
  where m.workspace_id = v_page.workspace_id
    and m.user_id = any (coalesce(p_co_authors, '{}'))
    and m.user_id <> v_page.created_by;

  update public.pages
  set authored_content = p_authored, co_authors = v_co
  where id = p_page_id;

  insert into public.audit_events
    (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (
    auth.uid(), v_page.workspace_id, 'page_authorship_changed', 'page', p_page_id,
    jsonb_build_object('authored_content', p_authored, 'co_authors', coalesce(array_length(v_co, 1), 0))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Suggestion index: lifecycle, audit pair, badge counts. Not the diff —
-- that is in the document's marks.
-- ---------------------------------------------------------------------
create table public.page_suggestions (
  page_id uuid not null references public.pages (id) on delete cascade,
  id text not null,
  suggester_id uuid not null references public.users (id) on delete cascade,
  kind text not null default 'edit',
  excerpt text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users (id) on delete set null,
  resolution_reason text,
  owner_override boolean not null default false,
  primary key (page_id, id),
  constraint page_suggestions_status check (status in ('open', 'accepted', 'rejected', 'withdrawn')),
  constraint page_suggestions_id_length check (char_length(id) <= 80),
  constraint page_suggestions_excerpt_length check (char_length(excerpt) <= 500),
  constraint page_suggestions_reason_length check (char_length(resolution_reason) <= 1000)
);

create index page_suggestions_open_idx on public.page_suggestions (page_id) where status = 'open';

alter table public.page_suggestions enable row level security;

create policy page_suggestions_select on public.page_suggestions
  for select using (exists (select 1 from public.pages p where p.id = page_id));
create policy page_suggestions_insert on public.page_suggestions
  for insert with check (
    suggester_id = (select auth.uid())
    and status = 'open'
    and public.can_edit_page(page_id)
  );
-- Resolution goes through resolve_suggestion(); no direct update/delete.

-- Register suggestions the client created (idempotent). One audit event
-- per suggestion: the "suggested by S at t1" half of the pair.
create function public.register_suggestions(p_page_id uuid, p_items jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_ws uuid;
  v_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a json array';
  end if;
  select workspace_id into v_ws from public.pages where id = p_page_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.page_suggestions (page_id, id, suggester_id, kind, excerpt)
    values (
      p_page_id,
      left(v_item ->> 'id', 80),
      auth.uid(),
      coalesce(left(v_item ->> 'kind', 20), 'edit'),
      left(coalesce(v_item ->> 'excerpt', ''), 500)
    )
    on conflict (page_id, id) do nothing;
    if found then
      v_count := v_count + 1;
      insert into public.audit_events
        (actor_id, workspace_id, event_type, target_type, target_id, metadata)
      values (
        auth.uid(), v_ws, 'suggestion_created', 'page', p_page_id,
        jsonb_build_object('suggestion_id', left(v_item ->> 'id', 80), 'kind', coalesce(v_item ->> 'kind', 'edit'))
      );
    end if;
  end loop;
  return v_count;
end;
$$;

-- Resolve one suggestion: authors accept or reject; the suggester may
-- withdraw; a workspace owner may accept or reject with a typed reason,
-- recorded as an override (the safety valve for departed users).
create function public.resolve_suggestion(
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
  if v_row.status <> 'open' then
    raise exception 'suggestion already %', v_row.status;
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
-- Enforcement (brief §2.2): what a page says, canonically — block types
-- and text in document order — from a rows array or from the table.
-- ---------------------------------------------------------------------
create function public.block_rows_text(p_rows jsonb)
returns text
language sql stable
set search_path = public
as $$
  with recursive rows as (
    select r ->> 'id' as id,
           r ->> 'parent_block_id' as parent_id,
           r ->> 'type' as type,
           r ->> 'position' as position,
           coalesce(r -> 'content', '{}'::jsonb) as content
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  ), tree as (
    select id, type, content, array[position] as path
    from rows
    where parent_id is null or parent_id not in (select id from rows where id is not null)
    union all
    select r.id, r.type, r.content, t.path || r.position
    from rows r join tree t on r.parent_id = t.id
  )
  select coalesce(string_agg(
    type || ':' || coalesce((
      -- Every inline text node, in document order (no array unwrapping).
      select string_agg(v ->> 'text', '')
      from jsonb_path_query(content, 'strict $.**') as v
      where jsonb_typeof(v) = 'object' and v ->> 'type' = 'text'
    ), ''),
    E'\n' order by path
  ), '')
  from tree;
$$;

create function public.page_rows_text(p_page_id uuid)
returns text
language sql stable
set search_path = public
as $$
  select public.block_rows_text(coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'parent_block_id', b.parent_block_id, 'type', b.type,
      'position', b.position, 'content', b.content
    ))
    from public.blocks b where b.page_id = p_page_id
  ), '[]'::jsonb));
$$;

-- A non-author saving an authored page may not change its clean state.
-- A workspace owner who just resolved a suggestion here is applying that
-- resolution and passes.
create function public.assert_authored_edit(p_page_id uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_page public.pages%rowtype;
begin
  select * into v_page from public.pages where id = p_page_id;
  if not coalesce(v_page.authored_content, false) then
    return;
  end if;
  if public.page_is_author(p_page_id) then
    return;
  end if;
  if public.workspace_role_at_least(v_page.workspace_id, 'owner') and exists (
    select 1 from public.page_suggestions s
    where s.page_id = p_page_id
      and s.resolved_by = auth.uid()
      and s.resolved_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  if public.block_rows_text(p_blocks) is distinct from public.page_rows_text(p_page_id) then
    raise exception 'authored_content: only the page author can change its text — suggest instead';
  end if;
end;
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

  perform public.assert_authored_edit(p_page_id, p_blocks);

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

-- ---------------------------------------------------------------------
-- Synced blocks follow their source page's rule (brief §2.5): a block
-- sourced from an authored page is read-only for non-authors in every
-- placement (suggesting inside placements comes with block-level
-- suggestions).
-- ---------------------------------------------------------------------
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
    'tombstone', s.source_page_id is null or s.deleted_at is not null,
    'deleted_at', s.deleted_at,
    'can_edit', s.source_page_id is not null
      and p.deleted_at is null
      and s.deleted_at is null
      and public.can_edit_page(s.source_page_id)
      and (not p.authored_content or public.page_is_author(p.id)),
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

  if exists (
    select 1 from public.synced_blocks s join public.pages p on p.id = s.source_page_id
    where s.id = p_id and p.authored_content and not public.page_is_author(p.id)
  ) then
    raise exception 'authored_content: only the source page''s author can edit this synced block';
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

revoke execute on function public.page_is_author(uuid) from anon;
revoke execute on function public.set_page_authorship(uuid, boolean, uuid[]) from public, anon;
revoke execute on function public.register_suggestions(uuid, jsonb) from public, anon;
revoke execute on function public.resolve_suggestion(uuid, text, text, text) from public, anon;
revoke execute on function public.assert_authored_edit(uuid, jsonb) from public, anon;

-- rollback:
--   (restore public.save_synced_block and public.load_synced_block from 0016/0015)
--   (restore public.replace_page_blocks from 0015)
--   drop function if exists public.assert_authored_edit(uuid, jsonb);
--   drop function if exists public.page_rows_text(uuid);
--   drop function if exists public.block_rows_text(jsonb);
--   drop function if exists public.resolve_suggestion(uuid, text, text, text);
--   drop function if exists public.register_suggestions(uuid, jsonb);
--   drop policy if exists page_suggestions_insert on public.page_suggestions;
--   drop policy if exists page_suggestions_select on public.page_suggestions;
--   drop table if exists public.page_suggestions;
--   drop function if exists public.set_page_authorship(uuid, boolean, uuid[]);
--   drop trigger if exists pages_guard_authorship on public.pages;
--   drop function if exists public.pages_guard_authorship();
--   drop function if exists public.page_is_author(uuid);
--   alter table public.pages drop column if exists co_authors;
--   alter table public.pages drop column if exists authored_content;
