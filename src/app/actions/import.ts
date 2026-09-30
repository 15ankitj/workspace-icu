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
} from "@/lib/action-result";
import {
  flattenDocument,
  MAX_BLOCKS_PER_PAGE,
  MAX_DOCUMENT_BYTES,
  type EditorBlock,
} from "@/lib/blocks";
import { extractPageLinks } from "@/lib/links";
import { firstPosition, positionAfter } from "@/lib/position";
import { siblingsOf } from "@/lib/tree";
import type { Json } from "@/lib/database.types";

/**
 * Create a page with ready-made content (Markdown/.docx import, brief §5).
 * The document was parsed in the browser by the editor itself; images
 * were uploaded through the normal gate beforehand.
 */
export async function createPageWithContent(input: {
  workspaceId: string;
  parentPageId: string | null;
  title: string;
  document: EditorBlock[];
}): Promise<ActionResult<{ pageId: string }>> {
  return runAction(async () => {
    if (!Array.isArray(input.document)) return fail("Invalid document");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const rows = flattenDocument(input.document);
    if (rows.length > MAX_BLOCKS_PER_PAGE) {
      return fail(`Pages are limited to ${MAX_BLOCKS_PER_PAGE} blocks`);
    }
    const payload = rows as unknown as Json;
    if (JSON.stringify(payload).length > MAX_DOCUMENT_BYTES) {
      return fail("Imported content is too large");
    }

    const { data: pages } = await supabase
      .from("pages")
      .select(
        "id, parent_page_id, position, title, icon, is_private, created_by",
      )
      .eq("workspace_id", input.workspaceId)
      .is("deleted_at", null);
    const last = siblingsOf(pages ?? [], input.parentPageId).at(-1);

    const { data: page, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: input.workspaceId,
        parent_page_id: input.parentPageId,
        title: input.title.trim().slice(0, 200),
        position: last ? positionAfter(last.position) : firstPosition(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return fromSupabaseError(error);

    const { error: blocksError } = await supabase.rpc("replace_page_blocks", {
      p_page_id: page.id,
      p_blocks: payload,
    });
    if (blocksError) return fromSupabaseError(blocksError);

    await supabase.rpc("set_page_links", {
      p_source_page_id: page.id,
      p_target_page_ids: extractPageLinks(input.document),
    });
    await supabase.from("audit_events").insert({
      actor_id: user.id,
      workspace_id: input.workspaceId,
      event_type: "page_imported",
      target_type: "page",
      target_id: page.id,
      metadata: { blocks: rows.length },
    });

    revalidatePath(`/w/${input.workspaceId}`, "layout");
    return ok({ pageId: page.id });
  });
}

/** Empty page for an import that needs a page id before uploading images. */
export async function createEmptyPage(
  workspaceId: string,
  parentPageId: string | null,
  title: string,
): Promise<ActionResult<{ pageId: string }>> {
  return createPageWithContent({
    workspaceId,
    parentPageId,
    title,
    document: [],
  });
}
