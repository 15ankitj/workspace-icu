-- 0010: templates and the gallery (Phase 6, brief §3/§10).

-- ---------------------------------------------------------------------
-- Platform owner: curates the gallery (brief §4). Seeded by email; add
-- further owners with an insert.
-- ---------------------------------------------------------------------
create table public.platform_owners (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_owners enable row level security;

create policy platform_owners_select_self on public.platform_owners
  for select using (user_id = (select auth.uid()));

create function public.is_platform_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from platform_owners where user_id = auth.uid());
$$;

insert into public.platform_owners (user_id)
select id from public.users where lower(email) = '15ankitj@gmail.com'
on conflict (user_id) do nothing;

-- Stable key linking an instantiated page back to its template page, for
-- "add the new pages" on template updates (brief §10).
alter table public.pages add column template_page_key text;

-- ---------------------------------------------------------------------
-- Templates, versions, gallery (brief §7).
-- ---------------------------------------------------------------------
create type public.template_scope as enum ('platform', 'workspace');
create type public.template_kind as enum ('page', 'tree', 'workspace');

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_scope public.template_scope not null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  source_page_id uuid references public.pages (id) on delete set null,
  name text not null,
  description text not null default '',
  purpose text not null default '',
  category text not null default 'Personal',
  audience text not null default '',
  kind public.template_kind not null,
  current_version_id uuid,
  is_published boolean not null default false,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  constraint templates_workspace_scope check (
    (owner_scope = 'workspace' and workspace_id is not null)
    or (owner_scope = 'platform' and workspace_id is null)
  )
);

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  changelog text not null default '',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

alter table public.templates
  add constraint templates_current_version_fkey
  foreign key (current_version_id) references public.template_versions (id)
  on delete set null;

create table public.gallery_entries (
  template_id uuid primary key references public.templates (id) on delete cascade,
  category text not null,
  sort_order int not null default 0,
  hero_image_url text,
  organisation_id uuid references public.organisations (id) on delete cascade,
  published_at timestamptz not null default now()
);

create index templates_workspace_idx on public.templates (workspace_id);

alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.gallery_entries enable row level security;

create function public.can_view_template(t uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from templates x
    where x.id = t
      and (
        (x.owner_scope = 'platform' and (x.is_published or public.is_platform_owner()))
        or (x.owner_scope = 'workspace' and public.is_workspace_member(x.workspace_id))
      )
  );
$$;

create function public.can_manage_template(t uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from templates x
    where x.id = t
      and (
        (x.owner_scope = 'platform' and public.is_platform_owner())
        or (
          x.owner_scope = 'workspace'
          and (
            x.created_by = auth.uid()
            or public.workspace_role_at_least(x.workspace_id, 'owner')
          )
        )
      )
  );
$$;

create policy templates_select on public.templates
  for select using (public.can_view_template(id));
create policy templates_insert on public.templates
  for insert with check (
    created_by = (select auth.uid())
    and (
      (owner_scope = 'workspace' and public.workspace_role_at_least(workspace_id, 'editor'))
      or (owner_scope = 'platform' and public.is_platform_owner())
    )
  );
create policy templates_update on public.templates
  for update using (public.can_manage_template(id))
  with check (public.can_manage_template(id));
create policy templates_delete on public.templates
  for delete using (public.can_manage_template(id));

-- Versions are immutable once written.
create policy template_versions_select on public.template_versions
  for select using (public.can_view_template(template_id));
create policy template_versions_insert on public.template_versions
  for insert with check (public.can_manage_template(template_id));

create policy gallery_entries_select on public.gallery_entries
  for select to authenticated using (true);
create policy gallery_entries_owner_all on public.gallery_entries
  for all using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- ---------------------------------------------------------------------
-- Template assets: copies of files referenced by template pages, stored
-- under {template_id}/{version}/{file_key} (brief §10). Readable by any
-- signed-in user (they can only reach them through a template they can
-- see); writable by whoever manages the template.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('template-assets', 'template-assets', false, 26214400)
on conflict (id) do nothing;

create policy storage_template_assets_select on storage.objects
  for select to authenticated using (bucket_id = 'template-assets');
create policy storage_template_assets_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'template-assets'
    and public.can_manage_template(((storage.foldername(name))[1])::uuid)
  );
create policy storage_template_assets_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'template-assets'
    and public.can_manage_template(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------
-- Instantiation: insert prepared pages and their blocks atomically. The
-- caller (a server action) has already generated ids, remapped links and
-- computed positions; RLS on pages/blocks applies to every row.
-- p_pages: [{id, workspace_id, parent_page_id, position, title, icon,
--            cover_url, full_width, small_text, template_id,
--            template_version, template_page_key, blocks: [...]}]
-- ---------------------------------------------------------------------
create function public.insert_template_pages(p_pages jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  p jsonb;
begin
  if jsonb_typeof(p_pages) <> 'array' then
    raise exception 'p_pages must be a json array';
  end if;

  for p in select * from jsonb_array_elements(p_pages) loop
    insert into public.pages (
      id, workspace_id, parent_page_id, position, title, icon, cover_url,
      full_width, small_text, template_id, template_version,
      template_page_key, created_by
    ) values (
      (p ->> 'id')::uuid,
      (p ->> 'workspace_id')::uuid,
      nullif(p ->> 'parent_page_id', '')::uuid,
      p ->> 'position',
      coalesce(p ->> 'title', ''),
      p ->> 'icon',
      p ->> 'cover_url',
      coalesce((p ->> 'full_width')::boolean, false),
      coalesce((p ->> 'small_text')::boolean, false),
      nullif(p ->> 'template_id', '')::uuid,
      nullif(p ->> 'template_version', '')::int,
      p ->> 'template_page_key',
      auth.uid()
    );
    perform public.replace_page_blocks(
      (p ->> 'id')::uuid,
      coalesce(p -> 'blocks', '[]'::jsonb)
    );
  end loop;
end;
$$;

-- rollback:
--   drop function if exists public.insert_template_pages(jsonb);
--   drop policy if exists storage_template_assets_delete on storage.objects;
--   drop policy if exists storage_template_assets_insert on storage.objects;
--   drop policy if exists storage_template_assets_select on storage.objects;
--   delete from storage.buckets where id = 'template-assets';  -- requires empty bucket
--   drop policy if exists gallery_entries_owner_all on public.gallery_entries;
--   drop policy if exists gallery_entries_select on public.gallery_entries;
--   drop policy if exists template_versions_insert on public.template_versions;
--   drop policy if exists template_versions_select on public.template_versions;
--   drop policy if exists templates_delete on public.templates;
--   drop policy if exists templates_update on public.templates;
--   drop policy if exists templates_insert on public.templates;
--   drop policy if exists templates_select on public.templates;
--   drop function if exists public.can_manage_template(uuid);
--   drop function if exists public.can_view_template(uuid);
--   drop table if exists public.gallery_entries;
--   alter table public.templates drop constraint if exists templates_current_version_fkey;
--   drop table if exists public.template_versions;
--   drop table if exists public.templates;
--   drop type if exists public.template_kind;
--   drop type if exists public.template_scope;
--   alter table public.pages drop column if exists template_page_key;
--   drop function if exists public.is_platform_owner();
--   drop table if exists public.platform_owners;
