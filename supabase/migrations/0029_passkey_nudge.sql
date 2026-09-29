-- 0029: the one-time passkey enrolment nudge.
--
-- After an email sign-in the workspace shows a card offering to add a
-- passkey (feature flag FEATURE_PASSKEYS). "Add a passkey" or "Not now"
-- both stamp the user's row so the card never shows again. Passkeys
-- themselves live in Supabase Auth (auth schema), not here.

alter table public.users add column passkey_nudge_dismissed_at timestamptz;
comment on column public.users.passkey_nudge_dismissed_at is
  'When the user dismissed (or acted on) the one-time passkey nudge; null = not yet shown or dismissed.';

-- Stamps the caller's own row only; a second call keeps the first time.
create function public.dismiss_passkey_nudge()
returns void
language sql security definer
set search_path = public
as $$
  update public.users
  set passkey_nudge_dismissed_at = coalesce(passkey_nudge_dismissed_at, now())
  where id = auth.uid();
$$;

revoke execute on function public.dismiss_passkey_nudge() from public, anon;

-- rollback:
--   drop function if exists public.dismiss_passkey_nudge();
--   alter table public.users drop column if exists passkey_nudge_dismissed_at;
