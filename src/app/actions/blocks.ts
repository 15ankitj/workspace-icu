"use server";

import { redirect } from "next/navigation";
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
import type { Json } from "@/lib/database.types";

/**
 * Persist the editor's whole document for a page (local-only mode). The
 * database function swaps the page's rows in one transaction under the
 * caller's RLS, so permissions are enforced server-side regardless of
 * what the client sends. Backlinks are refreshed from the same document.
 */
export async function savePageContent(
  pageId: string,
  document: EditorBlock[],
): Promise<ActionResult> {
  return runAction(async () => {
    if (!Array.isArray(document)) return fail("Invalid document");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const rows = flattenDocument(document);
    if (rows.length > MAX_BLOCKS_PER_PAGE) {
      return fail(`Pages are limited to ${MAX_BLOCKS_PER_PAGE} blocks`);
    }
    const payload = rows as unknown as Json;
    if (JSON.stringify(payload).length > MAX_DOCUMENT_BYTES) {
      return fail("Page content is too large");
    }

    const { error } = await supabase.rpc("replace_page_blocks", {
      p_page_id: pageId,
      p_blocks: payload,
    });
    // An authored-content refusal carries code "authored_content": the
    // editor retries it quietly rather than alarming a suggester.
    if (error) return fromSupabaseError(error);

    // Best-effort; the page save itself has already succeeded.
    await supabase.rpc("set_page_links", {
      p_source_page_id: pageId,
      p_target_page_ids: extractPageLinks(document),
    });
    return ok();
  });
}
