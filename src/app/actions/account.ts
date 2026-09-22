"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
export async function deleteMyAccount(formData: FormData) {
  const confirmation = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  if (confirmation !== DELETE_CONFIRMATION) {
    throw new Error(`Type “${DELETE_CONFIRMATION}” to confirm`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(`Could not delete account: ${error.message}`);

  await supabase.auth.signOut();
  redirect("/sign-in");
}
