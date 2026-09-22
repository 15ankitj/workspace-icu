-- 0023: review hardening, batch 1.
--
-- Four faults from the code review, one migration:
--  1. `pages` UPDATE let any editor rewrite `created_by` (and so become
--     the author) and `workspace_id`. A trigger now pins both: a page's
--     creator may hand it on (account deletion reassigns that way);
--     nobody else may change it, and a page never changes workspace.
--  2. Storage policies were wider than the row policies: any workspace
--     member could list and download attachments of colleagues' private
--     pages straight from the bucket, and every signed-in user could
--     read every template asset. Reads now require the `files` row (RLS:
--     the page is visible) or a template the caller can see.
--  3. `consume_rate_limit` took the window length from the caller, so a
--     user could reset their own window. Limits are now fixed per action
--     inside the function.
--  4. `mark_suggestions_stale` let any editor void anyone's suggestions,
--     including non-authors on authored pages. It now requires the page
--     author on authored pages, and a stale marking no longer opens the
--     owner's ten-minute editing window.

-- 1. Page identity ------------------------------------------------------

create function public.pages_guard_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'a page cannot move to another workspace';
  end if;
  if new.created_by is distinct from old.created_by
     and old.created_by is distinct from auth.uid() then
    raise exception 'only the page creator can hand the page on';
  end if;
  return new;
end;
$$;

create trigger pages_guard_identity
  before update of created_by, workspace_id on public.pages
  for each row execute function public.pages_guard_identity();

-- 2. Storage -----------------------------------------------------------

drop policy if exists storage_files_select on storage.objects;
create policy storage_files_select on storage.objects
  for select to authenticated using (
    bucket_id = 'files'
    and exists (
      select 1 from public.files f where f.storage_path = storage.objects.name
    )
  );

drop policy if exists storage_template_assets_select on storage.objects;
create policy storage_template_assets_select on storage.objects
  for select to authenticated using (
    bucket_id = 'template-assets'
    and public.can_view_template(((storage.foldername(name))[1])::uuid)
  );

-- 3. Rate limits -------------------------------------------------------

drop function if exists public.consume_rate_limit(text, int, int);

create function public.consume_rate_limit(p_action text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_limit int;
  v_window interval;
  v_count int;
begin
  if auth.uid() is null then
    return false;
  end if;
  -- Brief §12. Unknown actions are refused rather than unlimited.
  case p_action
    when 'file_upload' then v_limit := 60; v_window := interval '1 hour';
    when 'invite_create' then v_limit := 20; v_window := interval '1 hour';
    else raise exception 'unknown rate-limited action: %', p_action;
  end case;

  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, now(), 1)
  on conflict (user_id, action) do update
    set count = case
          when public.rate_limits.window_start < now() - v_window then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - v_window then now()
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= v_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text) from public, anon;

-- 4. Stale suggestions -------------------------------------------------

create or replace function public.mark_suggestions_stale(p_page_id uuid, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row public.page_suggestions%rowtype;
  v_page public.pages%rowtype;
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.can_edit_page(p_page_id) then
    raise exception 'not allowed';
  end if;
  -- On an authored page only an author's edit can change the context;
  -- a suggester may not void other people's suggestions.
  if coalesce(v_page.authored_content, false) and not public.page_is_author(p_page_id) then
    raise exception 'only the page author can mark suggestions as no longer applying';
  end if;
  for v_row in
    update public.page_suggestions
    set status = 'stale', resolved_at = now(), resolved_by = auth.uid()
    where page_id = p_page_id and id = any (coalesce(p_ids, '{}')) and status = 'open'
    returning *
  loop
    v_count := v_count + 1;
    insert into public.audit_events
      (actor_id, workspace_id, event_type, target_type, target_id, metadata)
    values (
      auth.uid(), v_page.workspace_id, 'suggestion_stale', 'page', p_page_id,
      jsonb_build_object('suggestion_id', v_row.id, 'suggester_id', v_row.suggester_id)
    );
  end loop;
  return v_count;
end;
$$;

-- The owner's ten-minute window after resolving a suggestion is for
-- applying that resolution; a stale marking is not a resolution.
create or replace function public.assert_authored_edit(p_page_id uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_page public.pages%rowtype;
begin
  select * into v_page from public.pages where id = p_page_id;
  if not coalesce(v_page.authored_content, false) then
    return;
  end if;
  if public.page_is_author(p_page_id) then
    return;
  end if;
  if public.workspace_role_at_least(v_page.workspace_id, 'owner') and exists (
    select 1 from public.page_suggestions s
    where s.page_id = p_page_id
      and s.status in ('accepted', 'rejected')
      and s.resolved_by = auth.uid()
      and s.resolved_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  if public.block_rows_text(p_blocks) is distinct from public.page_rows_text(p_page_id) then
    raise exception 'authored_content: only the page author can change its text — suggest instead';
  end if;
end;
$$;

create or replace function public.assert_authored_synced_edit(p_id uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_source uuid;
  v_ws uuid;
  v_stored jsonb;
begin
  select s.source_page_id, s.workspace_id, s.blocks into v_source, v_ws, v_stored
  from public.synced_blocks s join public.pages p on p.id = s.source_page_id
  where s.id = p_id and p.authored_content;
  if v_source is null then
    return;
  end if;
  if public.page_is_author(v_source) then
    return;
  end if;
  if public.workspace_role_at_least(v_ws, 'owner') and exists (
    select 1 from public.page_suggestions s
    where s.page_id = v_source
      and s.status in ('accepted', 'rejected')
      and s.resolved_by = auth.uid()
      and s.resolved_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  if public.nested_blocks_text(p_blocks) is distinct from public.nested_blocks_text(v_stored) then
    raise exception 'authored_content: only the source page''s author can change this synced block — suggest instead';
  end if;
end;
$$;

-- rollback:
--   (restore assert_authored_synced_edit(uuid, jsonb) from 0021)
--   (restore assert_authored_edit(uuid, jsonb) from 0018)
--   (restore mark_suggestions_stale(uuid, text[]) from 0021)
--   drop function if exists public.consume_rate_limit(text);
--   (restore consume_rate_limit(text, int, int) from 0011)
--   drop policy if exists storage_template_assets_select on storage.objects;
--   create policy storage_template_assets_select on storage.objects
--     for select to authenticated using (bucket_id = 'template-assets');
--   drop policy if exists storage_files_select on storage.objects;
--   create policy storage_files_select on storage.objects
--     for select to authenticated using (
--       bucket_id = 'files'
--       and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
--     );
--   drop trigger if exists pages_guard_identity on public.pages;
--   drop function if exists public.pages_guard_identity();
