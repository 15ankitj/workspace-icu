-- 0028: accept_invite — idempotent for the person who accepted, with
-- stable error codes.
--
-- The invitation page can render more than once after a sign-in (see
-- src/app/invite/[token]/page.tsx). The 0009 lookup excluded accepted
-- rows, so the second call failed with "invitation not found or already
-- used" although the first had created the membership. Now:
--
--   * a token this same user already accepted returns the workspace again
--     while they are still a member of it — accepting is idempotent;
--   * every failure raises with its own SQLSTATE (class "IV", ours) and
--     the reason's stable name in DETAIL, keeping the human MESSAGE:
--
--       IV401  not_signed_in          sign in to accept an invitation
--       IV404  not_found              invitation not found
--       IV410  expired                invitation has expired
--       IV403  wrong_email            sent to a different email address
--       IV409  already_used_by_other  accepted by someone else
--       IV409  already_used           accepted by this user, who has since
--                                     been removed from the workspace: an
--                                     old link must not re-grant membership
--
-- The client reads DETAIL first, then the SQLSTATE (src/lib/invites.ts).
--
-- Rollback: `create or replace function public.accept_invite(p_token text)`
-- with the 0009 body (lookup `where token = p_token and accepted_at is
-- null`, plain `raise exception` messages).

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'sign in to accept an invitation'
      using errcode = 'IV401', detail = 'not_signed_in';
  end if;

  select * into v_invite
  from public.workspace_invites
  where token = p_token;

  if not found then
    raise exception 'invitation not found'
      using errcode = 'IV404', detail = 'not_found';
  end if;

  if v_invite.accepted_at is not null then
    if v_invite.accepted_by = auth.uid() then
      if exists (
        select 1 from public.workspace_members
        where workspace_id = v_invite.workspace_id and user_id = auth.uid()
      ) then
        -- Already accepted by this person: the same answer as the first time.
        return v_invite.workspace_id;
      end if;
      raise exception 'invitation has already been used'
        using errcode = 'IV409', detail = 'already_used';
    end if;
    raise exception 'invitation has already been used by someone else'
      using errcode = 'IV409', detail = 'already_used_by_other';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invitation has expired'
      using errcode = 'IV410', detail = 'expired';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'this invitation was sent to a different email address'
      using errcode = 'IV403', detail = 'wrong_email';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_invite.workspace_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

-- Unchanged from 0009, restated so the grant survives a replace.
revoke execute on function public.accept_invite(text) from public, anon;
