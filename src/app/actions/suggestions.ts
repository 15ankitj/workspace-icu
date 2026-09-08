"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SuggestionStatus } from "@/lib/suggestions";
import type { Json } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** Index suggestions the editor just created (Appendix A §2.3): the
 *  "suggested by S at t1" half of the audit pair. Idempotent. */
export async function registerSuggestions(
  pageId: string,
  items: { id: string; kind: string; excerpt: string }[],
): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("register_suggestions", {
    p_page_id: pageId,
    p_items: items.slice(0, 200) as unknown as Json,
  });
  if (error) throw new Error(`Could not record suggestions: ${error.message}`);
  return data ?? 0;
}

/** Accept, reject (authors; owners with a reason) or withdraw (suggester). */
export async function resolveSuggestion(
  pageId: string,
  id: string,
  outcome: Exclude<SuggestionStatus, "open">,
  reason?: string,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("resolve_suggestion", {
    p_page_id: pageId,
    p_id: id,
    p_outcome: outcome,
    p_reason: reason?.trim().slice(0, 1000) || undefined,
  });
  if (error) throw new Error(`Could not resolve suggestion: ${error.message}`);
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
