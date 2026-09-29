"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PASSKEY_NAME, MAX_PASSKEY_NAME_LENGTH } from "@/lib/passkeys";

/**
 * The server side of passkeys: the WebAuthn ceremonies run in the browser
 * (src/lib/passkeys.ts); these actions record the outcome in the audit
 * log and the nudge stamp, as the caller, under RLS. No admin API.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** The nudge card was acted on or dismissed: never show it again. */
export async function dismissPasskeyNudge(): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("dismiss_passkey_nudge");
  if (error) {
    throw new Error(`Could not save the passkey preference: ${error.message}`);
  }
}

/** Audit a successful registration ceremony. */
export async function recordPasskeyRegistered(
  passkeyId: string,
  friendlyName: string,
): Promise<void> {
  await auditPasskey("passkey_registered", passkeyId, friendlyName);
}

/** Audit a removal. Called after the passkey is gone. */
export async function recordPasskeyRemoved(
  passkeyId: string,
  friendlyName: string,
): Promise<void> {
  await auditPasskey("passkey_removed", passkeyId, friendlyName);
}

async function auditPasskey(
  eventType: "passkey_registered" | "passkey_removed",
  passkeyId: string,
  friendlyName: string,
) {
  if (typeof passkeyId !== "string" || !UUID.test(passkeyId)) {
    throw new Error("Invalid passkey id");
  }
  const { supabase, user } = await requireUser();
  // Account-level, not workspace-level: workspace_id stays null, which the
  // audit_events insert policy (migration 0004) allows for the actor.
  const { error } = await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: null,
    event_type: eventType,
    target_type: "passkey",
    target_id: passkeyId,
    metadata: { friendly_name: cleanName(friendlyName) },
  });
  if (error) {
    throw new Error(`Could not record the passkey change: ${error.message}`);
  }
}

function cleanName(name: unknown): string {
  const value = typeof name === "string" ? name.trim() : "";
  return value ? value.slice(0, MAX_PASSKEY_NAME_LENGTH) : DEFAULT_PASSKEY_NAME;
}
