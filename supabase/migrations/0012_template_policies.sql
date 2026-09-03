-- 0012: templates policies must not look the row up by id.
--
-- INSERT … RETURNING (and UPDATE … RETURNING) must also satisfy the
-- table's SELECT policy. templates_select was can_view_template(id), a
-- STABLE SECURITY DEFINER lookup that runs on the calling statement's
-- snapshot and therefore cannot see the row that statement is inserting —
-- so every "Save as template" and pack install failed with "new row
-- violates row-level security policy". The policies below use the row's
-- own columns instead. can_view_template / can_manage_template stay for
-- template_versions and gallery_entries, where the template row exists.

create function public.template_manageable(
  scope public.template_scope,
  ws uuid,
  creator uuid
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select (scope = 'platform' and public.is_platform_owner())
      or (
        scope = 'workspace'
        and (creator = auth.uid() or public.workspace_role_at_least(ws, 'owner'))
      );
$$;

drop policy templates_select on public.templates;
drop policy templates_update on public.templates;
drop policy templates_delete on public.templates;

create policy templates_select on public.templates
  for select using (
    (owner_scope = 'platform' and (is_published or public.is_platform_owner()))
    or (owner_scope = 'workspace' and public.is_workspace_member(workspace_id))
  );

create policy templates_update on public.templates
  for update
  using (public.template_manageable(owner_scope, workspace_id, created_by))
  with check (public.template_manageable(owner_scope, workspace_id, created_by));

create policy templates_delete on public.templates
  for delete using (public.template_manageable(owner_scope, workspace_id, created_by));

-- rollback:
--   drop policy templates_select on public.templates;
--   drop policy templates_update on public.templates;
--   drop policy templates_delete on public.templates;
--   create policy templates_select on public.templates
--     for select using (public.can_view_template(id));
--   create policy templates_update on public.templates
--     for update using (public.can_manage_template(id))
--     with check (public.can_manage_template(id));
--   create policy templates_delete on public.templates
--     for delete using (public.can_manage_template(id));
--   drop function if exists public.template_manageable(public.template_scope, uuid, uuid);
