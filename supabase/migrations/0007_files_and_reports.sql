-- 0007: files, content reports, and the storage bucket (Phase 4).
--
-- Uploads go browser → Storage directly (server request bodies are too
-- small for 25 MB); storage RLS on the workspace path segment is the
-- boundary, and the bucket enforces size and MIME limits server-side.
-- Paths are {workspace_id}/{page_id}/{file_id}. One private bucket with
-- per-workspace path policies gives the same isolation as the brief's
-- bucket-per-workspace with none of the service-role bucket churn.

create type public.phi_scan_status as enum
  ('not_scanned', 'clear', 'flagged', 'overridden');

create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  uploader_id uuid not null references public.users (id),
  storage_path text not null unique,
  filename text not null,
  mime text not null,
  size_bytes bigint not null,
  phi_scan_status public.phi_scan_status not null default 'not_scanned',
  phi_scan_findings jsonb not null default '[]'::jsonb,
  aup_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index files_page_idx on public.files (page_id) where deleted_at is null;
create index files_uploader_idx on public.files (uploader_id);

alter table public.files enable row level security;

-- Visible when the page is visible (pages RLS applies in the subquery);
-- writes require edit rights on the page.
create policy files_select on public.files
  for select using (
    exists (select 1 from public.pages p where p.id = page_id)
  );
create policy files_insert on public.files
  for insert with check (
    public.can_edit_page(page_id) and uploader_id = (select auth.uid())
  );
create policy files_update on public.files
  for update using (public.can_edit_page(page_id))
  with check (public.can_edit_page(page_id));
create policy files_delete on public.files
  for delete using (public.can_edit_page(page_id));

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null,
  file_id uuid references public.files (id) on delete set null,
  reason text not null,
  status text not null default 'open', -- open | resolved | quarantined
  created_at timestamptz not null default now(),
  constraint content_reports_target check (page_id is not null or file_id is not null)
);

alter table public.content_reports enable row level security;

-- Reporters see their own reports; resolution is a platform-owner
-- (dashboard) operation in v1.
create policy content_reports_select_own on public.content_reports
  for select using (reporter_id = (select auth.uid()));
create policy content_reports_insert on public.content_reports
  for insert with check (reporter_id = (select auth.uid()));

-- Private bucket with server-enforced size and MIME limits (images, PDF,
-- Office, plain text, CSV, Markdown — no SVG, which can carry scripts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files', 'files', false, 26214400,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: the first path segment is the workspace id.
create policy storage_files_select on storage.objects
  for select to authenticated using (
    bucket_id = 'files'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
create policy storage_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'files'
    and public.workspace_role_at_least(((storage.foldername(name))[1])::uuid, 'editor')
  );
create policy storage_files_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'files'
    and public.workspace_role_at_least(((storage.foldername(name))[1])::uuid, 'editor')
  );

-- rollback:
--   drop policy if exists storage_files_delete on storage.objects;
--   drop policy if exists storage_files_insert on storage.objects;
--   drop policy if exists storage_files_select on storage.objects;
--   delete from storage.buckets where id = 'files';  -- requires empty bucket
--   drop policy if exists content_reports_insert on public.content_reports;
--   drop policy if exists content_reports_select_own on public.content_reports;
--   drop table if exists public.content_reports;
--   drop policy if exists files_delete on public.files;
--   drop policy if exists files_update on public.files;
--   drop policy if exists files_insert on public.files;
--   drop policy if exists files_select on public.files;
--   drop table if exists public.files;
--   drop type if exists public.phi_scan_status;
