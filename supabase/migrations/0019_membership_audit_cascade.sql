-- 0019: membership audit must survive cascades.
--
-- `workspace_members` rows are removed by cascade when a workspace is
-- deleted (account deletion of a personal or single-member workspace,
-- the nightly purge of trashed workspaces) and when a user is deleted.
-- The audit trigger then inserted an event referencing the workspace —
-- or the actor — that was already gone, and the whole delete failed
-- with a foreign-key error. The event is still written; it just stops
-- referencing what no longer exists and records the id in metadata.

create or replace function public.audit_membership_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_ws uuid;
begin
  -- The actor may be the account being deleted.
  if v_actor is not null
    and not exists (select 1 from public.users u where u.id = v_actor) then
    v_actor := null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      v_actor,
      new.workspace_id,
      'member_added',
      'workspace_member',
      new.user_id,
      jsonb_build_object('role', new.role, 'invited_by', new.invited_by)
    );
    return new;
  elsif tg_op = 'DELETE' then
    -- The workspace may be the one being removed (cascade).
    select w.id into v_ws from public.workspaces w where w.id = old.workspace_id;
    insert into public.audit_events (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      v_actor,
      v_ws,
      'member_removed',
      'workspace_member',
      old.user_id,
      jsonb_build_object(
        'role', old.role,
        'workspace_id', old.workspace_id,
        'workspace_deleted', v_ws is null
      )
    );
    return old;
  end if;
  return null;
end;
$$;

-- rollback:
--   (restore public.audit_membership_change from 0004)
