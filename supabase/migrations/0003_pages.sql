-- 0003: pages (tree, fractional positions, private flag, soft delete),
-- plus the "Getting started" page on sign-up.

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_page_id uuid references public.pages (id) on delete cascade,
  title text not null default '',
  icon text,
  cover_url text,
  position text not null, -- fractional index; siblings order lexicographically
  is_private boolean not null default false,
  full_width boolean not null default false,
  small_text boolean not null default false,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  template_id uuid,      -- provenance; FK added when templates land (Phase 6)
  template_version int
);

create index pages_workspace_idx on public.pages (workspace_id) where deleted_at is null;
create index pages_parent_idx on public.pages (parent_page_id) where deleted_at is null;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;

-- Private pages are visible only to their creator, whatever the
-- workspace role (brief §4).
create policy pages_select on public.pages
  for select using (
    public.is_workspace_member(workspace_id)
    and (not is_private or created_by = (select auth.uid()))
  );
create policy pages_insert on public.pages
  for insert with check (
    public.workspace_role_at_least(workspace_id, 'editor')
    and created_by = (select auth.uid())
  );
create policy pages_update on public.pages
  for update using (
    public.workspace_role_at_least(workspace_id, 'editor')
    and (not is_private or created_by = (select auth.uid()))
  )
  with check (
    public.workspace_role_at_least(workspace_id, 'editor')
    and (not is_private or created_by = (select auth.uid()))
  );
create policy pages_delete on public.pages
  for delete using (
    public.workspace_role_at_least(workspace_id, 'editor')
    and (not is_private or created_by = (select auth.uid()))
  );

-- Extend sign-up: also seed the "Getting started" page ('a0' is the first
-- fractional-index key).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_display_name text;
  personal_workspace_id uuid;
begin
  new_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, email, display_name, accepted_terms_at, accepted_aup_version)
  values (
    new.id,
    new.email,
    new_display_name,
    case when new.raw_user_meta_data ? 'accepted_aup_version' then now() end,
    new.raw_user_meta_data ->> 'accepted_aup_version'
  );

  insert into public.workspaces (name, icon, is_personal, created_by)
  values (new_display_name || '''s workspace', '🏠', true, new.id)
  returning id into personal_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (personal_workspace_id, new.id, 'owner');

  insert into public.pages (workspace_id, title, icon, position, created_by)
  values (personal_workspace_id, 'Getting started', '👋', 'a0', new.id);

  return new;
end;
$$;

-- rollback:
--   (restore public.handle_new_user() to its 0002 body)
--   drop policy if exists pages_delete on public.pages;
--   drop policy if exists pages_update on public.pages;
--   drop policy if exists pages_insert on public.pages;
--   drop policy if exists pages_select on public.pages;
--   drop trigger if exists pages_set_updated_at on public.pages;
--   drop function if exists public.set_updated_at();
--   drop table if exists public.pages;
