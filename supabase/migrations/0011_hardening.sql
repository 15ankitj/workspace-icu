-- 0011: hardening (Phase 9) — rate limits and account deletion.

-- ---------------------------------------------------------------------
-- Rate limits (brief §12): fixed windows per user and action, consumed
-- from server actions before the guarded operation.
-- ---------------------------------------------------------------------
create table public.rate_limits (
  user_id uuid not null references public.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null default now(),
  count int not null default 0,
  primary key (user_id, action)
);

alter table public.rate_limits enable row level security;
-- No end-user policies: only the SECURITY DEFINER function touches it.

create function public.consume_rate_limit(
  p_action text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return false;
  end if;

  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, now(), 1)
  on conflict (user_id, action) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon;

-- ---------------------------------------------------------------------
-- Account deletion (brief §5/§9): owned personal-workspace content is
-- purged; content in shared workspaces is reassigned to a workspace
-- owner, never deleted. Storage objects for purged files are removed by
-- the calling server action beforehand.
-- ---------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws record;
  v_role public.workspace_role;
  v_new_owner uuid;
begin
  if v_user is null then
    raise exception 'sign in to delete your account';
  end if;
  if exists (select 1 from public.platform_owners where user_id = v_user) then
    raise exception 'platform owners must hand over ownership before deleting their account';
  end if;

  for v_ws in
    select w.id, w.is_personal, w.created_by
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id and m.user_id = v_user
  loop
    select role into v_role
    from public.workspace_members
    where workspace_id = v_ws.id and user_id = v_user;

    if v_ws.is_personal then
      delete from public.workspaces where id = v_ws.id;
      continue;
    end if;

    -- Find who takes over authored content: another owner, else the
    -- longest-standing other member (promoted), else nobody — in which
    -- case the workspace had only this user and is purged.
    select user_id into v_new_owner
    from public.workspace_members
    where workspace_id = v_ws.id and role = 'owner' and user_id <> v_user
    order by joined_at limit 1;

    if v_new_owner is null and v_role = 'owner' then
      select user_id into v_new_owner
      from public.workspace_members
      where workspace_id = v_ws.id and user_id <> v_user
      order by joined_at limit 1;
      if v_new_owner is null then
        delete from public.workspaces where id = v_ws.id;
        continue;
      end if;
      update public.workspace_members set role = 'owner'
      where workspace_id = v_ws.id and user_id = v_new_owner;
    end if;

    if v_new_owner is null then
      -- Member of a workspace whose owner is someone else.
      select user_id into v_new_owner
      from public.workspace_members
      where workspace_id = v_ws.id and role = 'owner'
      order by joined_at limit 1;
    end if;

    update public.pages set created_by = v_new_owner
      where workspace_id = v_ws.id and created_by = v_user;
    update public.blocks set created_by = v_new_owner
      where created_by = v_user
        and page_id in (select id from public.pages where workspace_id = v_ws.id);
    update public.files set uploader_id = v_new_owner
      where workspace_id = v_ws.id and uploader_id = v_user;
    update public.comments set author_id = v_new_owner
      where author_id = v_user
        and page_id in (select id from public.pages where workspace_id = v_ws.id);
    update public.workspaces set created_by = v_new_owner
      where id = v_ws.id and created_by = v_user;
    update public.workspace_invites set invited_by = v_new_owner
      where workspace_id = v_ws.id and invited_by = v_user;
    update public.templates set created_by = v_new_owner
      where workspace_id = v_ws.id and created_by = v_user;

    delete from public.workspace_members
      where workspace_id = v_ws.id and user_id = v_user;
  end loop;

  update public.workspace_members set invited_by = null where invited_by = v_user;
  update public.workspace_invites set accepted_by = null where accepted_by = v_user;

  insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id)
  values (null, null, 'account_deleted', 'user', v_user);

  delete from public.users where id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;

-- rollback:
--   drop function if exists public.delete_my_account();
--   drop function if exists public.consume_rate_limit(text, int, int);
--   drop table if exists public.rate_limits;
