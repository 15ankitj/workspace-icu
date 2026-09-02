"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
) {
  if (typeof ydocBase64 !== "string" || !Array.isArray(document)) {
    throw new Error("Invalid document");
  }
  if (ydocBase64.length > MAX_YDOC_BASE64_CHARS) {
    throw new Error("Page content is too large");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const rows = flattenDocument(document);
  if (rows.length > MAX_BLOCKS_PER_PAGE) {
    throw new Error(`Pages are limited to ${MAX_BLOCKS_PER_PAGE} blocks`);
  }
  const payload = rows as unknown as Json;
  if (JSON.stringify(payload).length > MAX_DOCUMENT_BYTES) {
    throw new Error("Page content is too large");
  }

  const { error } = await supabase.rpc("save_page_document", {
    p_page_id: pageId,
    p_ydoc_base64: ydocBase64,
    p_blocks: payload,
  });
  if (error) throw new Error(`Could not save page: ${error.message}`);

  await supabase.rpc("set_page_links", {
    p_source_page_id: pageId,
    p_target_page_ids: extractPageLinks(document),
  });
}
