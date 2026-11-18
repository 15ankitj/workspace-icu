"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  ok,
  runAction,
  type ActionResult,
  type FormState,
} from "@/lib/action-result";

/**
 * All actions run on the user-scoped client: RLS is the authorisation
 * boundary, so a failed permission check surfaces as a database error, not
 * an app-level branch.
 */

/** Creates the workspace and redirects into it; a result comes back
 *  only on failure. */
export async function createWorkspace(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return ok();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    // One definer call creates the workspace and the owner membership
    // together: a plain insert cannot return its row before the caller is
    // a member (migration 0013).
    const { data: workspaceId, error } = await supabase.rpc(
      "create_workspace",
      {
        p_name: name,
      },
    );
    if (error) return fromSupabaseError(error);
    if (!workspaceId) return fail("Could not create the workspace");

    redirect(`/w/${workspaceId}`);
  });
}

export async function renameWorkspace(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!workspaceId || !name) return ok();

    const supabase = await createClient();
    const { error } = await supabase
      .from("workspaces")
      .update({ name })
      .eq("id", workspaceId);
    if (error) return fromSupabaseError(error);

    revalidatePath(`/w/${workspaceId}`, "layout");
    return ok();
  });
}

/**
 * Delete a workspace: to the trash, restorable for 30 days, then purged
 * by the nightly job. The database refuses unless the caller is the owner
 * and its only member, and always for a personal workspace (migration
 * 0032); the typed name is checked here. Redirects home on success.
 */
export async function deleteWorkspace(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const confirmation = String(formData.get("confirm") ?? "")
      .trim()
      .toLowerCase();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const { data: workspace, error: readError } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) return fromSupabaseError(readError);
    if (!workspace) return fail("Workspace not found");
    if (confirmation !== workspace.name.trim().toLowerCase()) {
      return fail("Type the workspace name to confirm");
    }

    const { error } = await supabase.rpc("delete_workspace", {
      p_id: workspaceId,
    });
    if (error) return fromSupabaseError(error);

    revalidatePath("/", "layout");
    redirect("/");
  });
}

/** Bring a trashed workspace back, within its 30 days. */
export async function restoreWorkspace(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const supabase = await createClient();
    const { error } = await supabase.rpc("restore_workspace", {
      p_id: workspaceId,
    });
    if (error) return fromSupabaseError(error);
    revalidatePath("/", "layout");
    return ok();
  });
}

/** Make another member the owner; the caller stays on as an editor. */
export async function transferOwnership(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return fail("Choose the new owner");

    const supabase = await createClient();
    const { error } = await supabase.rpc("transfer_workspace_ownership", {
      p_id: workspaceId,
      p_to: userId,
    });
    if (error) return fromSupabaseError(error);
    revalidatePath(`/w/${workspaceId}`, "layout");
    return ok();
  });
}

/** Leave a workspace the caller does not own; redirects home on success. */
export async function leaveWorkspace(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const { error } = await supabase.rpc("leave_workspace", {
      p_id: workspaceId,
    });
    if (error) return fromSupabaseError(error);

    revalidatePath("/", "layout");
    redirect("/");
  });
}
