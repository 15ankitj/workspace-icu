"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  CountResult,
  ResolveResult,
  SuggestionOutcome,
  SuggestionStatus,
} from "@/lib/suggestions";
import type { Json } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

// The suggestion actions return results instead of throwing. In
// production Next.js strips the message from an error thrown inside a
// server action and the client receives only a generic digest (React
// #441), so an expected refusal — "only the page author can resolve
// suggestions", "context changed" — would reach the reviewer as a crash.
// The redirect to sign-in in requireUser() still throws, as redirects
// must.

/** Index suggestions the editor just created (Appendix A §2.3): the
 *  "suggested by S at t1" half of the audit pair. Idempotent. */
export async function registerSuggestions(
  pageId: string,
  items: { id: string; kind: string; excerpt: string }[],
): Promise<CountResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, count: 0 };
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("register_suggestions", {
    p_page_id: pageId,
    p_items: items.slice(0, 200) as unknown as Json,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: data ?? 0 };
}

/**
 * Accept, reject (authors; owners with a reason) or withdraw (suggester).
 * Idempotent (migration 0030): the result carries the suggestion's status
 * after the call, which on a repeat is the earlier outcome, whatever was
 * asked for; the client converges its document to that status.
 */
export async function resolveSuggestion(
  pageId: string,
  id: string,
  outcome: SuggestionOutcome,
  reason?: string,
): Promise<ResolveResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("resolve_suggestion", {
    p_page_id: pageId,
    p_id: id,
    p_outcome: outcome,
    p_reason: reason?.trim().slice(0, 1000) || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: (data ?? outcome) as SuggestionStatus };
}

/** Authored content and co-authors (brief §2.2); authors and owners only. */
export async function setPageAuthorship(
  workspaceId: string,
  pageId: string,
  authored: boolean,
  coAuthors: string[],
) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_page_authorship", {
    p_page_id: pageId,
    p_authored: authored,
    p_co_authors: coAuthors.slice(0, 50),
  });
  if (error) throw new Error(`Could not update authorship: ${error.message}`);
  revalidatePath(`/w/${workspaceId}/p/${pageId}`);
}

/** An editor's own change removed the marks of these open suggestions:
 *  they become "context changed" and the suggester is told (§2.4). */
export async function markSuggestionsStale(
  pageId: string,
  ids: string[],
): Promise<CountResult> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true, count: 0 };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("mark_suggestions_stale", {
    p_page_id: pageId,
    p_ids: ids.slice(0, 200),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: data ?? 0 };
}

/** Mark this user's unread notifications read (one workspace, or all). */
export async function markNotificationsRead(workspaceId?: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_notifications_read", {
    p_workspace_id: workspaceId,
  });
  if (error)
    throw new Error(`Could not update notifications: ${error.message}`);
  if (workspaceId) revalidatePath(`/w/${workspaceId}`, "layout");
}

/** Daily digest opt-out (Appendix A §2.5), from account settings. */
export async function setEmailDigest(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_email_digest", {
    p_enabled: enabled,
  });
  if (error)
    throw new Error(`Could not update the digest setting: ${error.message}`);
  revalidatePath(`/w/${workspaceId}/settings`);
}
