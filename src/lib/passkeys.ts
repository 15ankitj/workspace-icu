import { createClient } from "@/lib/supabase/client";

/**
 * Every passkey (WebAuthn) call in the app goes through this module and
 * nothing else touches `supabase.auth.passkey.*`, `registerPasskey` or
 * `signInWithPasskey`: the API is experimental in supabase-js (pinned to
 * an exact version for that reason, see docs/runbook.md "Sign-in"), so a
 * change to it lands in one file.
 *
 * A user dismissing the browser prompt is not an error: `register()`
 * resolves to null and `signIn()` to false, and callers show nothing.
 * Every other failure throws an Error carrying the library's message.
 *
 * User verification (biometric or PIN rather than mere device presence):
 * the one-call ceremonies expose no `userVerification` option — the
 * WebAuthn options are built by Supabase Auth and verified under its own
 * policy — so the default is used. Platform authenticators prompt for a
 * biometric or PIN by default in practice.
 */
export type Passkey = {
  id: string;
  /** Friendly name from the authenticator, or "Passkey" when it has none. */
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export const DEFAULT_PASSKEY_NAME = "Passkey";
export const MAX_PASSKEY_NAME_LENGTH = 120;

/** True when this browser exposes WebAuthn. Always false on the server. */
export function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function"
  );
}

/** Registers a passkey for the signed-in user. Null when the user cancelled. */
export async function register(): Promise<Passkey | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.registerPasskey();
  if (error) {
    if (isCancellation(error)) return null;
    throw toError(error);
  }
  return toPasskey(data);
}

/**
 * Signs in with a discoverable passkey; the authenticator picks the
 * account, so no email is asked for. False when the user cancelled. On
 * success the browser client has written the session cookies, and the
 * caller must do a full navigation so the server sees them.
 */
export async function signIn(): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) {
    if (isCancellation(error)) return false;
    throw toError(error);
  }
  if (!data.session) throw new Error("Passkey sign-in did not complete");
  return true;
}

/** The signed-in user's passkeys, oldest first. */
export async function list(): Promise<Passkey[]> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.passkey.list();
  if (error) throw toError(error);
  return (data ?? []).map(toPasskey);
}

export async function rename(id: string, name: string): Promise<Passkey> {
  const friendlyName = name.trim().slice(0, MAX_PASSKEY_NAME_LENGTH);
  if (!friendlyName) throw new Error("Enter a name for the passkey");
  const supabase = createClient();
  const { data, error } = await supabase.auth.passkey.update({
    passkeyId: id,
    friendlyName,
  });
  if (error) throw toError(error);
  return toPasskey(data);
}

export async function remove(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
  if (error) throw toError(error);
}

function toPasskey(item: {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}): Passkey {
  const name = item.friendly_name?.trim();
  return {
    id: item.id,
    name: name ? name : DEFAULT_PASSKEY_NAME,
    createdAt: item.created_at,
    lastUsedAt: item.last_used_at ?? null,
  };
}

/**
 * supabase-js maps the browser's `NotAllowedError` (the user closed the
 * prompt, or it timed out) to a WebAuthnError whose code says to look at
 * `cause`, and an aborted ceremony to `ERROR_CEREMONY_ABORTED`.
 */
function isCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (code === "ERROR_CEREMONY_ABORTED") return true;
  const causeName =
    cause && typeof cause === "object"
      ? (cause as { name?: unknown }).name
      : undefined;
  return (
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" &&
    (causeName === "NotAllowedError" || causeName === "AbortError")
  );
}

function toError(error: { message?: string }): Error {
  return new Error(error.message || "Passkey request failed");
}
