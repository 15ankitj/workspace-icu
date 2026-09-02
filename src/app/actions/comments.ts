"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** Page-level discussion thread (brief §5). Plain text bodies in v1. */
export async function addComment(
  workspaceId: string,
  pageId: string,
  text: string,
) {
  const trimmed = text.trim().slice(0, 5000);
  if (!trimmed) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("comments").insert({
    page_id: pageId,
    author_id: user.id,
    body: { text: trimmed },
  });
  if (error) throw new Error(`Could not add comment: ${error.message}`);
  revalidatePath(`/w/${workspaceId}/p/${pageId}`);
}

export async function setCommentResolved(
  workspaceId: string,
  pageId: string,
  commentId: string,
  resolved: boolean,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("comments")
    .update({ resolved })
    .eq("id", commentId);
  if (error) throw new Error(`Could not update comment: ${error.message}`);
  revalidatePath(`/w/${workspaceId}/p/${pageId}`);
}

export async function deleteComment(
  workspaceId: string,
  pageId: string,
  commentId: string,
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  if (error) throw new Error(`Could not delete comment: ${error.message}`);
  revalidatePath(`/w/${workspaceId}/p/${pageId}`);
}
