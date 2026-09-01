-- 0006: block storage for the editor (Phase 2).
--
-- Until real-time collaboration lands (Phase 3, Yjs in page_documents),
-- these rows are the source of truth for page content: the editor saves
-- its whole document and replace_page_blocks swaps the page's rows in one
-- transaction. From Phase 3 they become the derived, queryable projection
-- the brief describes (search, export, backlinks).
--
-- Block ids are text, not uuid: they are generated client-side by the
-- editor and only need to be stable and unique per page (the v2 to-do
-- constraint), not database-formatted.

create table public.blocks (
  id text primary key,
  page_id uuid not null references public.pages (id) on delete cascade,
  parent_block_id text references public.blocks (id) on delete cascade,
  type text not null,
  position text not null, -- fractional index among siblings
  content jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blocks_page_idx on public.blocks (page_id);
create index blocks_parent_idx on public.blocks (parent_block_id);

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

alter table public.blocks enable row level security;

-- Editability of a page, shared by the block policies. SECURITY DEFINER
-- (same accepted pattern as the membership helpers): replicates the pages
-- UPDATE policy — editor role, not soft-deleted, private only for the
-- creator.
create function public.can_edit_page(p_page_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from pages p
    where p.id = p_page_id
      and p.deleted_at is null
      and public.workspace_role_at_least(p.workspace_id, 'editor')
      and (not p.is_private or p.created_by = auth.uid())
  );
$$;

-- Readable when the page is readable: the subquery runs as the caller, so
-- the pages RLS (membership + private flag) applies.
create policy blocks_select on public.blocks
  for select using (
    exists (select 1 from public.pages p where p.id = page_id)
  );
create policy blocks_insert on public.blocks
  for insert with check (
    public.can_edit_page(page_id) and created_by = (select auth.uid())
  );
create policy blocks_update on public.blocks
  for update using (public.can_edit_page(page_id))
  with check (public.can_edit_page(page_id));
create policy blocks_delete on public.blocks
  for delete using (public.can_edit_page(page_id));

-- Atomically replace a page's blocks with the editor's document.
-- SECURITY INVOKER: every statement runs under the caller's RLS, so the
-- delete/insert/update below are all permission-checked. Rows arrive as a
-- jsonb array ordered parents-before-children:
--   [{"id","parent_block_id","type","position","content"}, ...]
create function public.replace_page_blocks(p_page_id uuid, p_blocks jsonb)
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

  -- Bumps updated_at via trigger and doubles as the edit-permission gate:
  -- a caller who cannot update the page updates zero rows.
  update public.pages set updated_at = now() where id = p_page_id;

  if not found then
    raise exception 'page not found or not editable';
  end if;
end;
$$;

-- rollback:
--   drop function if exists public.replace_page_blocks(uuid, jsonb);
--   drop policy if exists blocks_delete on public.blocks;
--   drop policy if exists blocks_update on public.blocks;
--   drop policy if exists blocks_insert on public.blocks;
--   drop policy if exists blocks_select on public.blocks;
--   drop function if exists public.can_edit_page(uuid);
--   drop trigger if exists blocks_set_updated_at on public.blocks;
--   drop table if exists public.blocks;
