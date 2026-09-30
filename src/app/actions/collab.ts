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

const MAX_YDOC_BASE64_CHARS = 12 * 1024 * 1024; // ~9 MB of Yjs state

/**
 * Persist the collaborative document (brief §8): the encoded Yjs state is
 * the source of truth in `page_documents`, a version row is captured
 * (coalesced, 90-day retention), and `blocks` is refreshed as the
 * queryable projection — all in one RLS-checked database function.
 * Backlinks are refreshed from the same document.
 */
export async function savePageDocument(
  pageId: string,
  ydocBase64: string,
  document: EditorBlock[],
): Promise<ActionResult> {
  return runAction(async () => {
    if (typeof ydocBase64 !== "string" || !Array.isArray(document)) {
      return fail("Invalid document");
    }
    if (ydocBase64.length > MAX_YDOC_BASE64_CHARS) {
      return fail("Page content is too large");
    }

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

    const { error } = await supabase.rpc("save_page_document", {
      p_page_id: pageId,
      p_ydoc_base64: ydocBase64,
      p_blocks: payload,
    });
    // An authored-content refusal carries code "authored_content": the
    // editor retries it quietly rather than alarming a suggester.
    if (error) return fromSupabaseError(error);

    await supabase.rpc("set_page_links", {
      p_source_page_id: pageId,
      p_target_page_ids: extractPageLinks(document),
    });
    return ok();
  });
}
