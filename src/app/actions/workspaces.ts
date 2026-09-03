"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * All actions run on the user-scoped client: RLS is the authorisation
 * boundary, so a failed permission check surfaces as a database error, not
 * an app-level branch.
 */

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // One definer call creates the workspace and the owner membership
  // together: a plain insert cannot return its row before the caller is
  // a member (migration 0013).
  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    p_name: name,
  });
  if (error || !workspaceId) {
    throw new Error(
      `Could not create workspace: ${error?.message ?? "unknown error"}`,
    );
  }

  redirect(`/w/${workspaceId}`);
}

export async function renameWorkspace(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!workspaceId || !name) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name })
    .eq("id", workspaceId);
  if (error) throw new Error(`Could not rename workspace: ${error.message}`);

  revalidatePath(`/w/${workspaceId}`, "layout");
}
