"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Not exported: a "use server" module may only export async functions.
const DELETE_CONFIRMATION = "delete my account";

/**
 * Account deletion with full erasure (brief §5, §9). Content in workspaces
 * that will be purged (personal, or where this user is the only member)
 * has its Storage objects removed here under the user's own rights; the
 * database function then purges those workspaces, reassigns anything
 * authored in shared workspaces to a workspace owner, and deletes the
 * user from auth.
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

  const [{ data: workspaces }, { data: members }] = await Promise.all([
    supabase.from("workspaces").select("id, is_personal"),
    supabase.from("workspace_members").select("workspace_id"),
  ]);
  const memberCount = new Map<string, number>();
  for (const m of members ?? []) {
    memberCount.set(m.workspace_id, (memberCount.get(m.workspace_id) ?? 0) + 1);
  }
  const purged = (workspaces ?? [])
    .filter((w) => w.is_personal || (memberCount.get(w.id) ?? 0) <= 1)
    .map((w) => w.id);

  if (purged.length > 0) {
    const { data: files } = await supabase
      .from("files")
      .select("storage_path")
      .in("workspace_id", purged);
    const paths = (files ?? []).map((f) => f.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from("files").remove(paths.slice(i, i + 100));
    }
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(`Could not delete account: ${error.message}`);

  await supabase.auth.signOut();
  redirect("/sign-in");
}
