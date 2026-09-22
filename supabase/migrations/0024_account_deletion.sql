-- 0024: account deletion, from the code review (batch 2).
--
-- Three faults:
--  1. The server action removed the user's Storage objects before calling
--     delete_my_account, which can refuse (platform owners) or fail; the
--     attachments were then gone from pages that still existed. The
--     function now records the paths of purged workspaces' files in
--     `storage_purge_queue`, inside the same transaction, and the nightly
--     purge job removes the objects with the service role.
--  2. `synced_blocks.created_by` cascades on user deletion and was never
--     reassigned, so a departing user's synced tables vanished from every
--     shared page. `page_shares.created_by` has no action and was never
--     reassigned, so anyone who had ever toggled a public link could not
--     delete their account. Both are reassigned now.
--  3. Content the user created in workspaces they later left kept
--     referencing them (pages, blocks, files, invites, templates,
--     workspaces), so the final delete raised a foreign-key error. A
--     sweep reassigns it to that workspace's longest-standing owner.
--  4. Found while testing: the function erased every workspace flagged
--     personal that the user was a *member* of — including other
--     people's personal workspaces they had been invited into. Only the
--     user's own personal workspace is erased now; someone else's is
--     handled like any shared workspace.
--  5. Found while testing: deleting the user row set `pages.updated_by`
--     to null by cascade, which fired the pages update trigger, which
--     stamped the departing user straight back in — a foreign-key error
--     for anyone who had ever edited a page. The trigger now stands down
--     while `workspace_icu.reassigning` is set, and the function clears
--     the user's editor references itself (last editor becomes unknown,
--     which is the truth).

create table public.storage_purge_queue (
  path text primary key,
  queued_at timestamptz not null default now()
);
alter table public.storage_purge_queue enable row level security;
-- No policies: written by delete_my_account (definer), drained by the
-- purge job (service role). Never user-visible.

create or replace function public.delete_my_account()
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
  -- Reassignment is bookkeeping, not editing: pages keep their last
  -- editor and edit time (see set_page_updated).
  perform set_config('workspace_icu.reassigning', 'on', true);

  for v_ws in
    select w.id, w.is_personal, w.created_by
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id and m.user_id = v_user
  loop
    select role into v_role
    from public.workspace_members
    where workspace_id = v_ws.id and user_id = v_user;

    if v_ws.is_personal and v_ws.created_by = v_user then
      insert into public.storage_purge_queue (path)
        select storage_path from public.files where workspace_id = v_ws.id
        on conflict (path) do nothing;
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
        insert into public.storage_purge_queue (path)
          select storage_path from public.files where workspace_id = v_ws.id
          on conflict (path) do nothing;
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

    perform public.reassign_user_content(v_ws.id, v_user, v_new_owner);

    delete from public.workspace_members
      where workspace_id = v_ws.id and user_id = v_user;
  end loop;

  -- Content left behind in workspaces the user is no longer a member of.
  for v_ws in
    select distinct w.id
    from public.workspaces w
    where exists (select 1 from public.pages p where p.workspace_id = w.id and p.created_by = v_user)
       or exists (select 1 from public.files f where f.workspace_id = w.id and f.uploader_id = v_user)
       or exists (select 1 from public.synced_blocks s where s.workspace_id = w.id and s.created_by = v_user)
       or exists (select 1 from public.workspace_invites i where i.workspace_id = w.id and i.invited_by = v_user)
       or exists (select 1 from public.templates t where t.workspace_id = w.id and t.created_by = v_user)
       or exists (select 1 from public.page_shares sh join public.pages p on p.id = sh.page_id
                  where p.workspace_id = w.id and sh.created_by = v_user)
       or exists (select 1 from public.blocks b join public.pages p on p.id = b.page_id
                  where p.workspace_id = w.id and b.created_by = v_user)
       or w.created_by = v_user
  loop
    select user_id into v_new_owner
    from public.workspace_members
    where workspace_id = v_ws.id and user_id <> v_user
    order by (role = 'owner') desc, joined_at
    limit 1;
    if v_new_owner is null then
      -- Nobody is left in it: an orphan, purged with its files.
      insert into public.storage_purge_queue (path)
        select storage_path from public.files where workspace_id = v_ws.id
        on conflict (path) do nothing;
      delete from public.workspaces where id = v_ws.id;
      continue;
    end if;
    perform public.reassign_user_content(v_ws.id, v_user, v_new_owner);
  end loop;

  update public.workspace_members set invited_by = null where invited_by = v_user;
  update public.workspace_invites set accepted_by = null where accepted_by = v_user;
  update public.pages set updated_by = null where updated_by = v_user;

  insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id)
  values (null, null, 'account_deleted', 'user', v_user);

  delete from public.users where id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

-- Everything in one workspace that names the departing user, handed to
-- the new owner. Runs inside delete_my_account only.
create function public.reassign_user_content(p_workspace_id uuid, p_from uuid, p_to uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.pages set created_by = p_to
    where workspace_id = p_workspace_id and created_by = p_from;
  update public.blocks set created_by = p_to
    where created_by = p_from
      and page_id in (select id from public.pages where workspace_id = p_workspace_id);
  update public.files set uploader_id = p_to
    where workspace_id = p_workspace_id and uploader_id = p_from;
  update public.comments set author_id = p_to
    where author_id = p_from
      and page_id in (select id from public.pages where workspace_id = p_workspace_id);
  update public.page_shares set created_by = p_to
    where created_by = p_from
      and page_id in (select id from public.pages where workspace_id = p_workspace_id);
  update public.synced_blocks set created_by = p_to
    where workspace_id = p_workspace_id and created_by = p_from;
  update public.workspaces set created_by = p_to
    where id = p_workspace_id and created_by = p_from;
  update public.workspace_invites set invited_by = p_to
    where workspace_id = p_workspace_id and invited_by = p_from;
  update public.templates set created_by = p_to
    where workspace_id = p_workspace_id and created_by = p_from;
end;
$$;

revoke execute on function public.reassign_user_content(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.set_page_updated()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('workspace_icu.reassigning', true) = 'on' then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- rollback:
--   (restore set_page_updated() from 0014)
--   drop function if exists public.reassign_user_content(uuid, uuid, uuid);
--   (restore delete_my_account() from 0011)
--   drop table if exists public.storage_purge_queue;
