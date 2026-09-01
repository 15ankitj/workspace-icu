-- 0002: workspaces, membership, and the personal workspace on sign-up.

create type public.workspace_role as enum ('owner', 'editor', 'commenter', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  organisation_id uuid references public.organisations (id) on delete set null,
  is_personal boolean not null default false,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.workspace_role not null,
  invited_by uuid references public.users (id),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Membership helpers are SECURITY DEFINER so policies can consult
-- workspace_members without recursive RLS evaluation.
create function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create function public.workspace_role_rank(r public.workspace_role)
returns int
language sql immutable
as $$
  select case r
    when 'owner' then 4
    when 'editor' then 3
    when 'commenter' then 2
    when 'viewer' then 1
  end;
$$;

create function public.workspace_role_at_least(ws uuid, min_role public.workspace_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
      and public.workspace_role_rank(role) >= public.workspace_role_rank(min_role)
  );
$$;

create function public.shares_workspace_with(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members mine
    join workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = target
  );
$$;

-- users: members of a shared workspace can see each other's profiles.
create policy users_select_co_members on public.users
  for select using (public.shares_workspace_with(id));

create policy workspaces_select_members on public.workspaces
  for select using (public.is_workspace_member(id));
-- Personal workspaces are only created by the sign-up trigger.
create policy workspaces_insert_own on public.workspaces
  for insert with check (created_by = (select auth.uid()) and not is_personal);
create policy workspaces_update_owner on public.workspaces
  for update using (public.workspace_role_at_least(id, 'owner'))
  with check (public.workspace_role_at_least(id, 'owner'));
create policy workspaces_delete_owner on public.workspaces
  for delete using (public.workspace_role_at_least(id, 'owner'));

create policy workspace_members_select on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
-- Owners manage membership; a workspace creator may insert their own
-- owner row (they have no membership yet at that point).
create policy workspace_members_insert on public.workspace_members
  for insert with check (
    public.workspace_role_at_least(workspace_id, 'owner')
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1 from public.workspaces w
        where w.id = workspace_id and w.created_by = (select auth.uid())
      )
    )
  );
create policy workspace_members_update_owner on public.workspace_members
  for update using (public.workspace_role_at_least(workspace_id, 'owner'))
  with check (public.workspace_role_at_least(workspace_id, 'owner'));
-- Owners remove members; anyone may leave a workspace themselves.
create policy workspace_members_delete on public.workspace_members
  for delete using (
    public.workspace_role_at_least(workspace_id, 'owner')
    or user_id = (select auth.uid())
  );

-- Extend sign-up: profile + personal workspace with owner membership.
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

  return new;
end;
$$;

-- rollback:
--   (restore public.handle_new_user() to its 0001 body)
--   drop policy if exists workspace_members_delete on public.workspace_members;
--   drop policy if exists workspace_members_update_owner on public.workspace_members;
--   drop policy if exists workspace_members_insert on public.workspace_members;
--   drop policy if exists workspace_members_select on public.workspace_members;
--   drop policy if exists workspaces_delete_owner on public.workspaces;
--   drop policy if exists workspaces_update_owner on public.workspaces;
--   drop policy if exists workspaces_insert_own on public.workspaces;
--   drop policy if exists workspaces_select_members on public.workspaces;
--   drop policy if exists users_select_co_members on public.users;
--   drop function if exists public.shares_workspace_with(uuid);
--   drop function if exists public.workspace_role_at_least(uuid, public.workspace_role);
--   drop function if exists public.workspace_role_rank(public.workspace_role);
--   drop function if exists public.is_workspace_member(uuid);
--   drop table if exists public.workspace_members;
--   drop table if exists public.workspaces;
--   drop type if exists public.workspace_role;
