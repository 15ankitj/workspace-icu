"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { descendantIds } from "@/lib/tree";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** Every page in the workspace the caller can see, trashed or not. */
async function allPages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
) {
  const { data } = await supabase
    .from("pages")
    .select(
      "id, parent_page_id, position, title, icon, is_private, created_by, deleted_at",
    )
    .eq("workspace_id", workspaceId);
  return data ?? [];
}

/**
 * Restore a trashed page with its trashed descendants. If its parent is
 * itself still in the trash, the page comes back at the top level so it
 * is reachable.
 */
export async function restorePage(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const { supabase, user } = await requireUser();

  const pages = await allPages(supabase, workspaceId);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const target = byId.get(pageId);
  if (!target?.deleted_at) throw new Error("Page is not in the trash");

  const ids = [pageId, ...descendantIds(pages, pageId)].filter(
    (id) => byId.get(id)?.deleted_at,
  );
  const parent = target.parent_page_id ? byId.get(target.parent_page_id) : null;
  if (target.parent_page_id && (!parent || parent.deleted_at)) {
    await supabase
      .from("pages")
      .update({ parent_page_id: null })
      .eq("id", pageId);
  }

  const { error } = await supabase
    .from("pages")
    .update({ deleted_at: null })
    .in("id", ids);
  if (error) throw new Error(`Could not restore page: ${error.message}`);

  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: workspaceId,
    event_type: "page_restored",
    target_type: "page",
    target_id: pageId,
    metadata: { pages: ids.length },
  });

  revalidatePath(`/w/${workspaceId}`, "layout");
  redirect(`/w/${workspaceId}/p/${pageId}`);
}

/**
 * Delete a trashed page and its descendants permanently, removing their
 * files from Storage first. Irreversible — the trash view asks twice.
 */
export async function purgePage(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const { supabase, user } = await requireUser();

  const pages = await allPages(supabase, workspaceId);
  const target = pages.find((p) => p.id === pageId);
  if (!target?.deleted_at) throw new Error("Page is not in the trash");
  const ids = [pageId, ...descendantIds(pages, pageId)];

  const { data: files } = await supabase
    .from("files")
    .select("storage_path")
    .in("page_id", ids);
  const paths = (files ?? []).map((f) => f.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from("files").remove(paths.slice(i, i + 100));
  }

  const { error } = await supabase.from("pages").delete().in("id", ids);
  if (error) throw new Error(`Could not delete page: ${error.message}`);

  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: workspaceId,
    event_type: "page_purged",
    target_type: "page",
    target_id: pageId,
    metadata: { pages: ids.length, files: paths.length },
  });

  revalidatePath(`/w/${workspaceId}`, "layout");
}
