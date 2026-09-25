-- 0025: relation properties (Appendix B) — links between pages.
--
-- A relation is a sixth page-property type. The property *row* lives in
-- `pages.properties` like the other five ({ id, type: "relation", label,
-- reverse_label }); the pages it holds live here, one row per link, so the
-- reverse side is a lookup by target, trash and restore need no rewrite of
-- other pages' jsonb, and template instantiation remaps ids in one place.
-- Two-way by default, same workspace only, trash-aware (owner decisions).
-- Still not a database: no rollups, no formulas, nothing computed.

create table public.page_relations (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  source_page_id     uuid not null references public.pages (id) on delete cascade,
  source_property_id text not null,
  target_page_id     uuid not null references public.pages (id) on delete cascade,
  position           text not null,
  created_by         uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint page_relations_distinct unique (source_page_id, source_property_id, target_page_id),
  constraint page_relations_not_self check (source_page_id <> target_page_id),
  constraint page_relations_property_id check (source_property_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint page_relations_position_length check (char_length(position) between 1 and 200)
);

comment on table public.page_relations is
  'Links held by relation properties (Appendix B). Stored once, visible from both pages.';
comment on column public.page_relations.source_property_id is
  'Id of the relation row in the source page''s properties.rows.';

create index page_relations_target_idx on public.page_relations (target_page_id);
create index page_relations_source_idx on public.page_relations (source_page_id, source_property_id);

alter table public.page_relations enable row level security;

-- ---------------------------------------------------------------------
-- Permissions (§4.2).
-- Read: both pages visible under pages RLS (the subqueries run as the
-- caller, the same pattern as blocks_select). A trashed page is still
-- visible to its workspace, so a link to it stays visible (§4.3).
-- Write: edit rights on both pages. Adding needs both pages live;
-- removing works while one side is in the trash (the chip reads
-- "(in trash)" and still has its ×), so the delete check ignores trash
-- the way reassign_synced_source does.
-- ---------------------------------------------------------------------
create function public.can_edit_page_ignoring_trash(p_page_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from pages p
    where p.id = p_page_id
      and public.workspace_role_at_least(p.workspace_id, 'editor')
      and (not p.is_private or p.created_by = auth.uid())
  );
$$;

create policy page_relations_select on public.page_relations
  for select using (
    exists (select 1 from public.pages p where p.id = source_page_id)
    and exists (select 1 from public.pages p where p.id = target_page_id)
  );
create policy page_relations_insert on public.page_relations
  for insert with check (
    public.can_edit_page(source_page_id)
    and public.can_edit_page(target_page_id)
    and created_by = (select auth.uid())
  );
-- Reordering within a property changes only `position`; the trigger
-- below refuses any change of the pages themselves.
create policy page_relations_update on public.page_relations
  for update using (
    public.can_edit_page(source_page_id)
    and public.can_edit_page_ignoring_trash(target_page_id)
  )
  with check (
    public.can_edit_page(source_page_id)
    and public.can_edit_page_ignoring_trash(target_page_id)
  );
create policy page_relations_delete on public.page_relations
  for delete using (
    public.can_edit_page_ignoring_trash(source_page_id)
    and public.can_edit_page_ignoring_trash(target_page_id)
  );

-- ---------------------------------------------------------------------
-- Invariants a policy cannot express: same workspace on both sides
-- (§4.1 rule 6), neither page in the trash when a link is made, the
-- relation row actually declared on the source page, and the per-property
-- cap (§7, proposed 200). SECURITY DEFINER so the check sees both pages
-- whatever the caller can see; a page the caller cannot see fails the
-- policies first.
-- ---------------------------------------------------------------------
create function public.page_relations_check()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_source public.pages%rowtype;
  v_target public.pages%rowtype;
  v_count integer;
begin
  if tg_op = 'UPDATE' and (
    new.source_page_id <> old.source_page_id
    or new.source_property_id <> old.source_property_id
    or new.target_page_id <> old.target_page_id
    or new.workspace_id <> old.workspace_id
  ) then
    raise exception 'a relation link cannot be moved; remove it and add another';
  end if;
  if tg_op = 'UPDATE' then
    return new;
  end if;

  select * into v_source from public.pages where id = new.source_page_id;
  select * into v_target from public.pages where id = new.target_page_id;
  if v_source.id is null or v_target.id is null then
    raise exception 'page not found';
  end if;
  if v_source.workspace_id <> new.workspace_id
    or v_target.workspace_id <> new.workspace_id then
    raise exception 'relations link pages in the same workspace only';
  end if;
  if v_source.deleted_at is not null or v_target.deleted_at is not null then
    raise exception 'a page in the trash cannot be linked';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_source.properties -> 'rows', '[]'::jsonb)) r
    where r ->> 'id' = new.source_property_id and r ->> 'type' = 'relation'
  ) then
    raise exception 'the source page has no relation property with that id';
  end if;
  select count(*) into v_count from public.page_relations
  where source_page_id = new.source_page_id
    and source_property_id = new.source_property_id;
  if v_count >= 200 then
    raise exception 'a relation holds at most 200 pages';
  end if;
  return new;
end;
$$;

create trigger page_relations_check
  before insert or update on public.page_relations
  for each row execute function public.page_relations_check();

-- ---------------------------------------------------------------------
-- Audit (§4.6): relation.link_added / relation.link_removed, written by
-- trigger so every path is covered once per link — the editor, the Trash
-- purge and the nightly job alike (§6: purge shows link_removed with
-- reason "purge"). A removal whose page is already gone is a purge: the
-- cascade fires after the page row is deleted. SECURITY DEFINER because
-- the nightly job has no auth.uid() for the audit insert policy.
-- relation.property_deleted is written by the action that removes the
-- row, since only it knows the count.
-- ---------------------------------------------------------------------
create function public.audit_page_relation()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_ws uuid;
  v_purge boolean;
begin
  if v_actor is not null
    and not exists (select 1 from public.users u where u.id = v_actor) then
    v_actor := null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      v_actor, new.workspace_id, 'relation.link_added', 'page_relation', new.id,
      jsonb_build_object(
        'source_page_id', new.source_page_id,
        'source_property_id', new.source_property_id,
        'target_page_id', new.target_page_id
      )
    );
    return new;
  end if;

  -- The workspace may itself be the thing being removed (cascade).
  select w.id into v_ws from public.workspaces w where w.id = old.workspace_id;
  v_purge := not exists (select 1 from public.pages p where p.id = old.source_page_id)
    or not exists (select 1 from public.pages p where p.id = old.target_page_id)
    or v_ws is null;
  insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (
    v_actor, v_ws, 'relation.link_removed', 'page_relation', old.id,
    jsonb_build_object(
      'source_page_id', old.source_page_id,
      'source_property_id', old.source_property_id,
      'target_page_id', old.target_page_id,
      'workspace_id', old.workspace_id,
      'reason', case when v_purge then 'purge' else 'removed' end
    )
  );
  return old;
end;
$$;

create trigger page_relations_audit
  after insert or delete on public.page_relations
  for each row execute function public.audit_page_relation();

-- ---------------------------------------------------------------------
-- Templates (§4.5): links between pages of one snapshot travel as pairs
-- and are recreated with the new ids. `p_relations` rows carry the new
-- page ids already (the planner remaps keys); each insert runs under the
-- caller's RLS and the checks above. Older callers pass nothing. The
-- two-argument signature is dropped first: left in place beside this one,
-- a call naming only p_pages and p_synced would match both.
-- ---------------------------------------------------------------------
drop function if exists public.insert_template_pages(jsonb, jsonb);

create function public.insert_template_pages(
  p_pages jsonb,
  p_synced jsonb default '[]'::jsonb,
  p_relations jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  p jsonb;
  s jsonb;
  r jsonb;
  v_text text;
begin
  if jsonb_typeof(p_pages) <> 'array'
    or jsonb_typeof(p_synced) <> 'array'
    or jsonb_typeof(p_relations) <> 'array' then
    raise exception 'p_pages, p_synced and p_relations must be json arrays';
  end if;

  for p in select * from jsonb_array_elements(p_pages) loop
    insert into public.pages (
      id, workspace_id, parent_page_id, position, title, icon, cover_url,
      description, properties,
      full_width, small_text, authored_content, template_id, template_version,
      template_page_key, created_by
    ) values (
      (p ->> 'id')::uuid,
      (p ->> 'workspace_id')::uuid,
      nullif(p ->> 'parent_page_id', '')::uuid,
      p ->> 'position',
      coalesce(p ->> 'title', ''),
      p ->> 'icon',
      p ->> 'cover_url',
      coalesce(p ->> 'description', ''),
      case
        when jsonb_typeof(p -> 'properties') = 'object' then p -> 'properties'
        else '{"hidden":[],"rows":[]}'::jsonb
      end,
      coalesce((p ->> 'full_width')::boolean, false),
      coalesce((p ->> 'small_text')::boolean, false),
      coalesce((p ->> 'authored_content')::boolean, false),
      nullif(p ->> 'template_id', '')::uuid,
      nullif(p ->> 'template_version', '')::int,
      p ->> 'template_page_key',
      auth.uid()
    );
  end loop;

  for s in select * from jsonb_array_elements(p_synced) loop
    select left(string_agg(v #>> '{}', ' '), 200000) into v_text
    from jsonb_path_query(coalesce(s -> 'blocks', '[]'::jsonb), 'lax $.**.text') as v
    where jsonb_typeof(v) = 'string';

    insert into public.synced_blocks
      (id, workspace_id, source_page_id, template_key, title, blocks, search_text, created_by)
    values (
      (s ->> 'id')::uuid,
      (s ->> 'workspace_id')::uuid,
      (s ->> 'source_page_id')::uuid,
      nullif(s ->> 'template_key', ''),
      left(coalesce(s ->> 'title', ''), 200),
      coalesce(s -> 'blocks', '[]'::jsonb),
      v_text,
      auth.uid()
    );
  end loop;

  for p in select * from jsonb_array_elements(p_pages) loop
    perform public.replace_page_blocks((p ->> 'id')::uuid, coalesce(p -> 'blocks', '[]'::jsonb));
  end loop;

  for r in select * from jsonb_array_elements(p_relations) loop
    insert into public.page_relations
      (workspace_id, source_page_id, source_property_id, target_page_id, position, created_by)
    values (
      (r ->> 'workspace_id')::uuid,
      (r ->> 'source_page_id')::uuid,
      r ->> 'source_property_id',
      (r ->> 'target_page_id')::uuid,
      r ->> 'position',
      auth.uid()
    )
    on conflict on constraint page_relations_distinct do nothing;
  end loop;
end;
$$;

-- rollback:
--   (restore public.insert_template_pages(jsonb, jsonb) from 0022)
--   drop function if exists public.insert_template_pages(jsonb, jsonb, jsonb);
--   drop trigger if exists page_relations_audit on public.page_relations;
--   drop function if exists public.audit_page_relation();
--   drop trigger if exists page_relations_check on public.page_relations;
--   drop function if exists public.page_relations_check();
--   drop policy if exists page_relations_delete on public.page_relations;
--   drop policy if exists page_relations_update on public.page_relations;
--   drop policy if exists page_relations_insert on public.page_relations;
--   drop policy if exists page_relations_select on public.page_relations;
--   drop function if exists public.can_edit_page_ignoring_trash(uuid);
--   drop table if exists public.page_relations;
