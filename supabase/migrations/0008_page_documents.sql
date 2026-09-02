-- 0008: persisted Yjs documents (Phase 3, collaboration).
--
-- From now on the Yjs document is the source of truth for page content
-- (brief §7/§8) and `blocks` is its queryable projection. The live
-- transport is Liveblocks; Supabase stays the durable store so the
-- provider remains disposable. Versions are captured on persisted saves
-- (coalesced to one per 5 minutes per page) and pruned at 90 days (§14).

create table public.page_documents (
  page_id uuid primary key references public.pages (id) on delete cascade,
  ydoc bytea not null,
  updated_at timestamptz not null default now()
);

create table public.page_document_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  ydoc bytea not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index page_document_versions_page_idx
  on public.page_document_versions (page_id, created_at desc);

alter table public.page_documents enable row level security;
alter table public.page_document_versions enable row level security;

-- Readable when the page is readable (pages RLS applies in the subquery);
-- writable when the page is editable.
create policy page_documents_select on public.page_documents
  for select using (
    exists (select 1 from public.pages p where p.id = page_id)
  );
create policy page_documents_insert on public.page_documents
  for insert with check (public.can_edit_page(page_id));
create policy page_documents_update on public.page_documents
  for update using (public.can_edit_page(page_id))
  with check (public.can_edit_page(page_id));

create policy page_document_versions_select on public.page_document_versions
  for select using (
    exists (select 1 from public.pages p where p.id = page_id)
  );
create policy page_document_versions_insert on public.page_document_versions
  for insert with check (public.can_edit_page(page_id));
create policy page_document_versions_delete on public.page_document_versions
  for delete using (public.can_edit_page(page_id));

-- Persist one save: the encoded Yjs state (base64 over the wire), a
-- coalesced version row, retention pruning, and the blocks projection.
-- SECURITY INVOKER: every statement is RLS-checked as the caller.
create function public.save_page_document(
  p_page_id uuid,
  p_ydoc_base64 text,
  p_blocks jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_bytes bytea := decode(p_ydoc_base64, 'base64');
  v_last_version timestamptz;
begin
  insert into public.page_documents (page_id, ydoc, updated_at)
  values (p_page_id, v_bytes, now())
  on conflict (page_id) do update
    set ydoc = excluded.ydoc, updated_at = now();

  if not found then
    raise exception 'page not found or not editable';
  end if;

  select max(created_at) into v_last_version
  from public.page_document_versions
  where page_id = p_page_id;

  if v_last_version is null or v_last_version < now() - interval '5 minutes' then
    insert into public.page_document_versions (page_id, ydoc, created_by)
    values (p_page_id, v_bytes, auth.uid());
  end if;

  delete from public.page_document_versions
  where page_id = p_page_id and created_at < now() - interval '90 days';

  perform public.replace_page_blocks(p_page_id, p_blocks);
end;
$$;

-- Fetch the stored state as base64 (null when the page has none yet).
create function public.load_page_document(p_page_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select encode(ydoc, 'base64') from public.page_documents where page_id = p_page_id;
$$;

-- rollback:
--   drop function if exists public.load_page_document(uuid);
--   drop function if exists public.save_page_document(uuid, text, jsonb);
--   drop policy if exists page_document_versions_delete on public.page_document_versions;
--   drop policy if exists page_document_versions_insert on public.page_document_versions;
--   drop policy if exists page_document_versions_select on public.page_document_versions;
--   drop policy if exists page_documents_update on public.page_documents;
--   drop policy if exists page_documents_insert on public.page_documents;
--   drop policy if exists page_documents_select on public.page_documents;
--   drop table if exists public.page_document_versions;
--   drop table if exists public.page_documents;
