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

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create workspace: ${error.message}`);

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });
  if (memberError)
    throw new Error(`Could not join new workspace: ${memberError.message}`);

  redirect(`/w/${workspace.id}`);
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
