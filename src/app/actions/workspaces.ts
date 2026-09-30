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
