"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  runAction,
  type ActionResult,
  type FormState,
} from "@/lib/action-result";

// Not exported: a "use server" module may only export async functions.
const DELETE_CONFIRMATION = "delete my account";

/**
 * Account deletion with full erasure (brief §5, §9). One database
 * function purges the user's personal and sole-member workspaces,
 * queues their attachments for the nightly purge job to remove from
 * Storage, reassigns anything authored in shared workspaces to a
 * workspace owner, and deletes the user from auth — all in one
 * transaction, so a refusal (platform owners) changes nothing.
 */
export async function deleteMyAccount(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const confirmation = String(formData.get("confirm") ?? "")
      .trim()
      .toLowerCase();
    if (confirmation !== DELETE_CONFIRMATION) {
      return fail(`Type “${DELETE_CONFIRMATION}” to confirm`);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const { error } = await supabase.rpc("delete_my_account");
    if (error) return fromSupabaseError(error);

    await supabase.auth.signOut();
    redirect("/sign-in");
  });
}
