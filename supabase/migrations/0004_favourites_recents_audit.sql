-- 0004: favourites, recently viewed, and the append-only audit log with
-- membership events wired in.

create table public.favourites (
  user_id uuid not null references public.users (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  position text not null,
  primary key (user_id, page_id)
);

create table public.recent_pages (
  user_id uuid not null references public.users (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_workspace_idx on public.audit_events (workspace_id, created_at desc);

alter table public.favourites enable row level security;
alter table public.recent_pages enable row level security;
alter table public.audit_events enable row level security;

-- Favourites and recents are strictly per-user. The pages subquery runs
-- under the caller's own RLS, so only visible pages can be referenced.
create policy favourites_all_own on public.favourites
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.pages p where p.id = page_id)
  );

create policy recent_pages_all_own on public.recent_pages
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.pages p where p.id = page_id)
  );

-- Append-only: no UPDATE/DELETE policies, and the privileges are revoked
-- outright so not even a permissive future policy can reopen them by
-- accident.
revoke update, delete on public.audit_events from anon, authenticated;

create policy audit_events_select on public.audit_events
  for select using (
    actor_id = (select auth.uid())
    or public.workspace_role_at_least(workspace_id, 'owner')
  );
create policy audit_events_insert on public.audit_events
  for insert with check (
    actor_id = (select auth.uid())
    and (workspace_id is null or public.is_workspace_member(workspace_id))
  );

-- Membership changes are audited from triggers (SECURITY DEFINER, so the
-- write succeeds regardless of the actor's audit policy).
create function public.audit_membership_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      auth.uid(),
      new.workspace_id,
      'member_added',
      'workspace_member',
      new.user_id,
      jsonb_build_object('role', new.role, 'invited_by', new.invited_by)
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      auth.uid(),
      old.workspace_id,
      'member_removed',
      'workspace_member',
      old.user_id,
      jsonb_build_object('role', old.role)
    );
    return old;
  end if;
  return null;
end;
$$;

create trigger workspace_members_audit
  after insert or delete on public.workspace_members
  for each row execute function public.audit_membership_change();

-- rollback:
--   drop trigger if exists workspace_members_audit on public.workspace_members;
--   drop function if exists public.audit_membership_change();
--   drop policy if exists audit_events_insert on public.audit_events;
--   drop policy if exists audit_events_select on public.audit_events;
--   drop policy if exists recent_pages_all_own on public.recent_pages;
--   drop policy if exists favourites_all_own on public.favourites;
--   drop table if exists public.audit_events;
--   drop table if exists public.recent_pages;
--   drop table if exists public.favourites;
