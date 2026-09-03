-- 0013: create a workspace and its owner membership in one call.
--
-- Creating a workspace from the app was two statements: insert the
-- workspace (returning its id), then insert the owner membership. The
-- RETURNING step must pass the workspaces SELECT policy, which requires
-- a membership row that does not exist yet, so every "Create workspace"
-- failed with "new row violates row-level security policy". The personal
-- workspace never hit this because handle_new_user creates both rows in
-- one definer function; this does the same for user-created workspaces.

create function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_user is null then
    raise exception 'sign in to create a workspace';
  end if;
  if v_name = '' then
    raise exception 'give the workspace a name';
  end if;

  insert into public.workspaces (name, created_by)
  values (left(v_name, 120), v_user)
  returning id into v_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

revoke execute on function public.create_workspace(text) from public, anon;

-- rollback:
--   drop function if exists public.create_workspace(text);
