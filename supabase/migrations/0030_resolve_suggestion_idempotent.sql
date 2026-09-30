-- 0030: idempotent suggestion resolution (Appendix A §2.3).
--
-- Resolving a suggestion twice was a hard error ("suggestion already
-- accepted"), and in production a thrown server-action error reaches the
-- browser as an unreadable digest. The record and the document are kept
-- in step by the client converging the document to whatever the record
-- says, so `resolve_suggestion` now *reports* the status after the call
-- instead of raising when the row is already final: a repeat is a no-op
-- that returns the earlier outcome, writes no second audit event and
-- fires no second notification. Every rule for `open` and `stale` rows is
-- unchanged: stale cannot be accepted; only the suggester withdraws;
-- authors resolve; owners resolve with a reason (`owner_override`); the
-- audit event and the notification trigger fire exactly once, on the
-- transition. The return type changes, so the function is dropped and
-- recreated with its grants.

drop function if exists public.resolve_suggestion(uuid, text, text, text);

create function public.resolve_suggestion(
  p_page_id uuid,
  p_id text,
  p_outcome text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.page_suggestions%rowtype;
  v_page public.pages%rowtype;
  v_override boolean := false;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_outcome not in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'unknown outcome';
  end if;
  select * into v_row from public.page_suggestions
  where page_id = p_page_id and id = p_id;
  if v_row.page_id is null then
    raise exception 'suggestion not found';
  end if;
  -- Already final, whatever was asked for: report it and write nothing.
  -- The client brings its document into line with this status.
  if v_row.status in ('accepted', 'rejected', 'withdrawn') then
    return v_row.status;
  end if;
  if v_row.status = 'stale' and p_outcome = 'accepted' then
    raise exception 'context changed: this suggestion can no longer be applied';
  end if;
  select * into v_page from public.pages where id = p_page_id;

  if p_outcome = 'withdrawn' then
    if v_row.suggester_id <> auth.uid() then
      raise exception 'only the suggester can withdraw a suggestion';
    end if;
  elsif public.page_is_author(p_page_id) then
    v_override := false;
  elsif public.workspace_role_at_least(v_page.workspace_id, 'owner') then
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'a workspace owner resolving another author''s page must give a reason';
    end if;
    v_override := true;
  else
    raise exception 'only the page author can resolve suggestions';
  end if;

  update public.page_suggestions
  set status = p_outcome,
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_reason = case when v_override then v_reason else null end,
      owner_override = v_override
  where page_id = p_page_id and id = p_id;

  insert into public.audit_events
    (actor_id, workspace_id, event_type, target_type, target_id, metadata)
  values (
    auth.uid(), v_page.workspace_id, 'suggestion_' || p_outcome, 'page', p_page_id,
    jsonb_build_object(
      'suggestion_id', p_id,
      'suggester_id', v_row.suggester_id,
      'resolved_by', auth.uid(),
      'owner_override', v_override,
      'reason', case when v_override then v_reason else null end
    )
  );

  return p_outcome;
end;
$$;

revoke execute on function public.resolve_suggestion(uuid, text, text, text) from public, anon;

-- rollback:
--   drop function if exists public.resolve_suggestion(uuid, text, text, text);
--   (restore public.resolve_suggestion from 0021, then
--    revoke execute on function public.resolve_suggestion(uuid, text, text, text) from public, anon;)
