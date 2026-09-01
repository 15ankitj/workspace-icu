"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { positionAfter, positionBetween, firstPosition } from "@/lib/position";
import { canMove, descendantIds, siblingsOf, type TreePage } from "@/lib/tree";
import { isValidCover } from "@/lib/cover";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** Live (non-deleted) pages of a workspace visible to the caller. */
async function fetchTreePages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<TreePage[]> {
  const { data, error } = await supabase
    .from("pages")
    .select("id, parent_page_id, position, title, icon, is_private, created_by")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);
  if (error) throw new Error(`Could not load pages: ${error.message}`);
  return data ?? [];
}

export async function createPage(
  workspaceId: string,
  parentPageId: string | null,
) {
  const { supabase, user } = await requireUser();
  const pages = await fetchTreePages(supabase, workspaceId);
  const siblings = siblingsOf(pages, parentPageId);
  const last = siblings.at(-1);
  const position = last ? positionAfter(last.position) : firstPosition();

  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: workspaceId,
      parent_page_id: parentPageId,
      title: "",
      position,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create page: ${error.message}`);

  revalidatePath(`/w/${workspaceId}`, "layout");
  redirect(`/w/${workspaceId}/p/${page.id}`);
}

export async function renamePage(pageId: string, title: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pages")
    .update({ title })
    .eq("id", pageId)
    .select("workspace_id")
    .single();
  if (error) throw new Error(`Could not rename page: ${error.message}`);
  revalidatePath(`/w/${data.workspace_id}`, "layout");
}

export async function setPageIcon(pageId: string, icon: string | null) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pages")
    .update({ icon })
    .eq("id", pageId)
    .select("workspace_id")
    .single();
  if (error) throw new Error(`Could not set icon: ${error.message}`);
  revalidatePath(`/w/${data.workspace_id}`, "layout");
}

export async function setPageCover(pageId: string, cover: string | null) {
  const { supabase } = await requireUser();
  if (cover !== null && !isValidCover(cover)) {
    throw new Error("Covers must be a preset gradient or an https image URL");
  }
  const { data, error } = await supabase
    .from("pages")
    .update({ cover_url: cover })
    .eq("id", pageId)
    .select("workspace_id")
    .single();
  if (error) throw new Error(`Could not change cover: ${error.message}`);
  revalidatePath(`/w/${data.workspace_id}`, "layout");
}

export async function setPageLayout(
  pageId: string,
  layout: { fullWidth?: boolean; smallText?: boolean },
) {
  const { supabase } = await requireUser();
  const update: { full_width?: boolean; small_text?: boolean } = {};
  if (layout.fullWidth !== undefined) update.full_width = layout.fullWidth;
  if (layout.smallText !== undefined) update.small_text = layout.smallText;
  if (Object.keys(update).length === 0) return;

  const { data, error } = await supabase
    .from("pages")
    .update(update)
    .eq("id", pageId)
    .select("workspace_id")
    .single();
  if (error) throw new Error(`Could not change layout: ${error.message}`);
  revalidatePath(`/w/${data.workspace_id}`, "layout");
}

export async function setPagePrivacy(pageId: string, isPrivate: boolean) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pages")
    .update({ is_private: isPrivate })
    .eq("id", pageId)
    .select("workspace_id")
    .single();
  if (error) throw new Error(`Could not change privacy: ${error.message}`);
  revalidatePath(`/w/${data.workspace_id}`, "layout");
}

/**
 * Move a page to a new parent and/or position. `beforeId`/`afterId` are the
 * sibling ids the page should land between (either may be null for the
 * ends). Cycle prevention runs against the caller's visible tree; RLS
 * guards the write itself.
 */
export async function movePage(input: {
  workspaceId: string;
  pageId: string;
  newParentId: string | null;
  beforeId: string | null;
  afterId: string | null;
}) {
  const { supabase } = await requireUser();
  const pages = await fetchTreePages(supabase, input.workspaceId);

  if (!pages.some((p) => p.id === input.pageId)) {
    throw new Error("Page not found");
  }
  if (!canMove(pages, input.pageId, input.newParentId)) {
    throw new Error("Cannot move a page inside itself");
  }

  const siblings = siblingsOf(pages, input.newParentId).filter(
    (p) => p.id !== input.pageId,
  );
  const before = siblings.find((p) => p.id === input.beforeId) ?? null;
  const after = siblings.find((p) => p.id === input.afterId) ?? null;
  const position = positionBetween(
    before?.position ?? null,
    after?.position ?? null,
  );

  const { error } = await supabase
    .from("pages")
    .update({ parent_page_id: input.newParentId, position })
    .eq("id", input.pageId);
  if (error) throw new Error(`Could not move page: ${error.message}`);

  revalidatePath(`/w/${input.workspaceId}`, "layout");
}

/** Soft-delete a page and its visible descendants (30-day trash). */
export async function deletePage(workspaceId: string, pageId: string) {
  const { supabase } = await requireUser();
  const pages = await fetchTreePages(supabase, workspaceId);
  const ids = [pageId, ...descendantIds(pages, pageId)];

  const { error } = await supabase
    .from("pages")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(`Could not delete page: ${error.message}`);

  revalidatePath(`/w/${workspaceId}`, "layout");
  redirect(`/w/${workspaceId}`);
}

export async function toggleFavourite(workspaceId: string, pageId: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("favourites")
    .select("page_id")
    .eq("user_id", user.id)
    .eq("page_id", pageId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favourites")
      .delete()
      .eq("user_id", user.id)
      .eq("page_id", pageId);
    if (error) throw new Error(`Could not unfavourite: ${error.message}`);
  } else {
    const { data: favourites } = await supabase
      .from("favourites")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    const last = favourites?.at(-1)?.position ?? null;
    const { error } = await supabase.from("favourites").insert({
      user_id: user.id,
      page_id: pageId,
      position: last ? positionAfter(last) : firstPosition(),
    });
    if (error) throw new Error(`Could not favourite: ${error.message}`);
  }

  revalidatePath(`/w/${workspaceId}`, "layout");
}
