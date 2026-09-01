-- 0001: user profiles and organisations.
-- Applied to hosted projects via the Supabase MCP `apply_migration`
-- (staging first, production after merge). See docs/runbook.md.

create extension if not exists pgcrypto;

create type public.organisation_type as enum ('nhs_trust', 'deanery', 'other');
create type public.organisation_role as enum ('admin', 'member');

-- Profile row for every auth.users row, created by trigger below.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  gmc_number text, -- optional, self-declared
  accepted_terms_at timestamptz,
  accepted_aup_version text,
  created_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type public.organisation_type not null default 'other',
  created_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.organisation_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

alter table public.users enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

-- users: read/update own profile. Co-member visibility arrives in 0002
-- once workspace membership exists.
create policy users_select_self on public.users
  for select using (id = (select auth.uid()));
create policy users_update_self on public.users
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create function public.is_organisation_member(org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from organisation_members
    where organisation_id = org and user_id = auth.uid()
  );
$$;

create policy organisations_select_members on public.organisations
  for select using (public.is_organisation_member(id));

create policy organisation_members_select on public.organisation_members
  for select using (public.is_organisation_member(organisation_id));
-- Org membership writes are platform-owner/dashboard operations in v1;
-- no insert/update/delete policies for end users.

-- Profile creation on sign-up. Extended by 0002 (personal workspace) and
-- 0003 (Getting started page).
create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, accepted_terms_at, accepted_aup_version)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    case when new.raw_user_meta_data ? 'accepted_aup_version' then now() end,
    new.raw_user_meta_data ->> 'accepted_aup_version'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed the launch organisation (no members yet; kept lightweight).
insert into public.organisations (name, slug, type)
values ('St George''s University Hospitals NHS Foundation Trust', 'st-georges', 'nhs_trust')
on conflict (slug) do nothing;

-- rollback:
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop policy if exists organisation_members_select on public.organisation_members;
--   drop policy if exists organisations_select_members on public.organisations;
--   drop function if exists public.is_organisation_member(uuid);
--   drop policy if exists users_update_self on public.users;
--   drop policy if exists users_select_self on public.users;
--   drop table if exists public.organisation_members;
--   drop table if exists public.organisations;
--   drop table if exists public.users;
--   drop type if exists public.organisation_role;
--   drop type if exists public.organisation_type;
