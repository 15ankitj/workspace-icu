-- 0032: deleting a workspace, leaving one, handing one over.
--
-- The brief gives an owner "everything, including delete workspace,
-- manage members, transfer ownership" (§4) and a 30-day trash for
-- workspaces (§7). `workspaces.deleted_at` and the nightly purge of
-- trashed workspaces have existed since 0002; nothing ever set the column,
-- and nothing but a few app queries read it.
--
-- Meanwhile the 0002 policies let any owner, straight through the API:
-- hard-delete a workspace (shared or personal, attachments left behind in
-- Storage), write any of its columns, promote anyone to owner, or leave
-- and orphan it.
--
-- Rules from here on, held in the database:
--   * A workspace is deleted by its owner, only when the owner is its
--     only member, and never the personal workspace (that goes with the
--     account). Deleting is a soft delete: it can be restored for 30 days,
--     then the purge job removes it. Pending invitations are revoked.
--   * A trashed workspace is closed: the membership helpers every policy
--     rests on answer "no" for it, so its pages, files and search results
--     are unreachable until it is restored.
--   * One owner. Ownership changes only by `transfer_workspace_ownership`
--     (the new owner must already be a member; the old one stays on as an
--     editor). Policies no longer let a row become, or stop being, owner.
--   * A member who is not the owner may leave; what they wrote passes to
--     the owner, as it does on account deletion (0024). The owner hands
--     the workspace over first.
--   * Hard deletes are left to the purge job (service role) and
--     `delete_my_account` (definer).
--
-- Refusals are written as sentences: the app shows a P0001 message as is.

-- ---------------------------------------------------------------------
-- A trashed workspace has no members as far as RLS is concerned.
-- ---------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members m
    join workspaces w on w.id = m.workspace_id
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and w.deleted_at is null
  );
$$;

create or replace function public.workspace_role_at_least(ws uuid, min_role public.workspace_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members m
    join workspaces w on w.id = m.workspace_id
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and w.deleted_at is null
      and public.workspace_role_rank(m.role) >= public.workspace_role_rank(min_role)
  );
$$;

-- ---------------------------------------------------------------------
-- Policies: no hard delete, no free column writes, no owner rows by hand.
-- ---------------------------------------------------------------------
drop policy workspaces_delete_owner on public.workspaces;

revoke update on public.workspaces from anon, authenticated;
grant update (name, icon) on public.workspaces to authenticated;

drop policy workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert with check (
    (public.workspace_role_at_least(workspace_id, 'owner') and role <> 'owner')
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1 from public.workspaces w
        where w.id = workspace_id and w.created_by = (select auth.uid())
      )
    )
  );

drop policy workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner on public.workspace_members
  for update
  using (public.workspace_role_at_least(workspace_id, 'owner') and role <> 'owner')
  with check (public.workspace_role_at_least(workspace_id, 'owner') and role <> 'owner');

-- Owners remove members; leaving goes through leave_workspace.
drop policy workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete using (
    public.workspace_role_at_least(workspace_id, 'owner') and role <> 'owner'
  );

-- ---------------------------------------------------------------------
-- Delete (to the trash), restore, list.
-- ---------------------------------------------------------------------
create function public.delete_workspace(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws public.workspaces%rowtype;
begin
  select * into v_ws from public.workspaces where id = p_id and deleted_at is null;
  if v_ws.id is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_id and user_id = v_user
  ) then
    raise exception 'Workspace not found.';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_id and user_id = v_user and role = 'owner'
  ) then
    raise exception 'Only the owner can delete a workspace.';
  end if;
  if v_ws.is_personal then
    raise exception 'Your personal workspace cannot be deleted. It is removed when you delete your account.';
  end if;
  if exists (
    select 1 from public.workspace_members
    where workspace_id = p_id and user_id <> v_user
  ) then
    raise exception 'This workspace still has other members. Remove them, or transfer ownership and leave, before deleting it.';
  end if;

  delete from public.workspace_invites where workspace_id = p_id;
  update public.workspaces set deleted_at = now() where id = p_id;

  insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (v_user, p_id, 'workspace_deleted', 'workspace', p_id,
    jsonb_build_object('name', v_ws.name));
end;
$$;

create function public.restore_workspace(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id
    where w.id = p_id and w.deleted_at is not null
      and m.user_id = v_user and m.role = 'owner'
  ) then
    raise exception 'Workspace not found.';
  end if;

  update public.workspaces set deleted_at = null where id = p_id;

  insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id)
  values (v_user, p_id, 'workspace_restored', 'workspace', p_id);
end;
$$;

-- The caller's own trashed workspaces: RLS no longer shows them.
create function public.list_deleted_workspaces()
returns table (id uuid, name text, icon text, deleted_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select w.id, w.name, w.icon, w.deleted_at
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where m.user_id = auth.uid() and m.role = 'owner' and w.deleted_at is not null
  order by w.deleted_at desc;
$$;

-- ---------------------------------------------------------------------
-- Hand over, leave.
-- ---------------------------------------------------------------------
create function public.transfer_workspace_ownership(p_id uuid, p_to uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws public.workspaces%rowtype;
begin
  select * into v_ws from public.workspaces where id = p_id and deleted_at is null;
  if v_ws.id is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_id and user_id = v_user
  ) then
    raise exception 'Workspace not found.';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_id and user_id = v_user and role = 'owner'
  ) then
    raise exception 'Only the owner can transfer a workspace.';
  end if;
  if v_ws.is_personal then
    raise exception 'A personal workspace cannot be transferred.';
  end if;
  if p_to is null or p_to = v_user or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_id and user_id = p_to
  ) then
    raise exception 'Choose another member of this workspace as the new owner.';
  end if;

  update public.workspace_members set role = 'owner'
    where workspace_id = p_id and user_id = p_to;
  update public.workspace_members set role = 'editor'
    where workspace_id = p_id and user_id = v_user;
  update public.workspaces set created_by = p_to where id = p_id;

  insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (v_user, p_id, 'workspace_ownership_transferred', 'workspace', p_id,
    jsonb_build_object('from', v_user, 'to', p_to));
end;
$$;

create function public.leave_workspace(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role public.workspace_role;
  v_owner uuid;
begin
  select m.role into v_role
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.workspace_id = p_id and m.user_id = v_user and w.deleted_at is null;
  if v_role is null then
    raise exception 'Workspace not found.';
  end if;
  if v_role = 'owner' then
    raise exception 'The owner cannot leave a workspace. Transfer ownership first, or delete the workspace.';
  end if;

  select user_id into v_owner
  from public.workspace_members
  where workspace_id = p_id and role = 'owner'
  order by joined_at limit 1;

  if v_owner is not null then
    -- Bookkeeping, not editing: pages keep their last editor and edit time.
    perform set_config('workspace_icu.reassigning', 'on', true);
    perform public.reassign_user_content(p_id, v_user, v_owner);
    perform set_config('workspace_icu.reassigning', 'off', true);
  end if;

  -- member_removed is recorded by the membership audit trigger.
  delete from public.workspace_members
    where workspace_id = p_id and user_id = v_user;
end;
$$;

revoke execute on function public.delete_workspace(uuid) from public, anon;
revoke execute on function public.restore_workspace(uuid) from public, anon;
revoke execute on function public.list_deleted_workspaces() from public, anon;
revoke execute on function public.transfer_workspace_ownership(uuid, uuid) from public, anon;
revoke execute on function public.leave_workspace(uuid) from public, anon;

-- rollback:
--   drop function if exists public.leave_workspace(uuid);
--   drop function if exists public.transfer_workspace_ownership(uuid, uuid);
--   drop function if exists public.list_deleted_workspaces();
--   drop function if exists public.restore_workspace(uuid);
--   drop function if exists public.delete_workspace(uuid);
--   (restore the workspace_members_insert, workspace_members_update_owner
--    and workspace_members_delete policies from 0002)
--   revoke update (name, icon) on public.workspaces from authenticated;
--   grant update on public.workspaces to anon, authenticated;
--   create policy workspaces_delete_owner on public.workspaces
--     for delete using (public.workspace_role_at_least(id, 'owner'));
--   (restore public.is_workspace_member and public.workspace_role_at_least
--    from 0002; restore any workspace still trashed first, or it reopens)
