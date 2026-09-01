"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  flattenDocument,
  MAX_BLOCKS_PER_PAGE,
  MAX_DOCUMENT_BYTES,
  type EditorBlock,
} from "@/lib/blocks";
import type { Json } from "@/lib/database.types";

/**
 * Persist the editor's whole document for a page. The database function
 * swaps the page's rows in one transaction under the caller's RLS, so
 * permissions are enforced server-side regardless of what the client
 * sends. Last write wins until Yjs collaboration lands in Phase 3.
 */
export async function savePageContent(pageId: string, document: EditorBlock[]) {
  if (!Array.isArray(document)) {
    throw new Error("Invalid document");
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

  const { error } = await supabase.rpc("replace_page_blocks", {
    p_page_id: pageId,
    p_blocks: payload,
  });
  if (error) throw new Error(`Could not save page: ${error.message}`);
}
