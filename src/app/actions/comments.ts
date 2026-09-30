"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fromSupabaseError,
  ok,
  runAction,
  type ActionResult,
} from "@/lib/action-result";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** Page-level discussion thread (brief §5), or — with a suggestion id —
 *  the rationale thread anchored to a suggestion (Appendix A §2.3).
 *  Plain text bodies in v1. */
export async function addComment(
  workspaceId: string,
  pageId: string,
  text: string,
  suggestionId?: string | null,
): Promise<ActionResult> {
  return runAction(async () => {
    const trimmed = text.trim().slice(0, 5000);
    if (!trimmed) return ok();
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("comments").insert({
      page_id: pageId,
      author_id: user.id,
      body: { text: trimmed },
      suggestion_id: suggestionId?.slice(0, 80) ?? null,
    });
    if (error) return fromSupabaseError(error);
    revalidatePath(`/w/${workspaceId}/p/${pageId}`);
    return ok();
  });
}

export async function setCommentResolved(
  workspaceId: string,
  pageId: string,
  commentId: string,
  resolved: boolean,
): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("comments")
      .update({ resolved })
      .eq("id", commentId);
    if (error) return fromSupabaseError(error);
    revalidatePath(`/w/${workspaceId}/p/${pageId}`);
    return ok();
  });
}

export async function deleteComment(
  workspaceId: string,
  pageId: string,
  commentId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);
    if (error) return fromSupabaseError(error);
    revalidatePath(`/w/${workspaceId}/p/${pageId}`);
    return ok();
  });
}
