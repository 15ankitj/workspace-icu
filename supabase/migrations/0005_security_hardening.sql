-- 0005: hardening from Supabase security advisors.
--
-- 1. Pin search_path on the two functions that lacked it.
-- 2. Trigger functions must not be callable through the Data API: trigger
--    execution does not require caller EXECUTE, so revoking breaks nothing.
--
-- The advisor also warns that the SECURITY DEFINER membership helpers
-- (is_workspace_member, workspace_role_at_least, shares_workspace_with,
-- is_organisation_member) are executable by signed-in users. That is
-- intentional: RLS policies evaluate them as the querying user, so
-- authenticated must keep EXECUTE. They only return booleans about the
-- caller's own memberships, so direct RPC calls leak nothing.

alter function public.set_updated_at() set search_path = public;
alter function public.workspace_role_rank(public.workspace_role) set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_membership_change() from public, anon, authenticated;

-- rollback:
--   grant execute on function public.audit_membership_change() to public;
--   grant execute on function public.handle_new_user() to public;
--   alter function public.workspace_role_rank(public.workspace_role) reset search_path;
--   alter function public.set_updated_at() reset search_path;
