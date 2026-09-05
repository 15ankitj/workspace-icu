"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  flattenDocument,
  MAX_BLOCKS_PER_PAGE,
  MAX_DOCUMENT_BYTES,
  type EditorBlock,
} from "@/lib/blocks";
import { containsSyncedBlock, titleFromBlocks } from "@/lib/synced";
import type { Json } from "@/lib/database.types";

const MAX_YDOC_BASE64_CHARS = 4 * 1024 * 1024;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

function checkDocument(document: EditorBlock[]) {
  if (!Array.isArray(document)) throw new Error("Invalid document");
  const rows = flattenDocument(document);
  if (rows.length > MAX_BLOCKS_PER_PAGE) {
    throw new Error(
      `Synced blocks are limited to ${MAX_BLOCKS_PER_PAGE} blocks`,
    );
  }
  if (JSON.stringify(document).length > MAX_DOCUMENT_BYTES) {
    throw new Error("Synced block content is too large");
  }
}

/** What a placement renders from; null when the caller may not see the
 *  source page — the editor then shows a neutral placeholder. */
export interface SyncedBlockView {
  id: string;
  workspaceId: string;
  title: string;
  sourcePageId: string | null;
  sourceTitle: string | null;
  sourceIcon: string | null;
  sourceDeleted: boolean;
  tombstone: boolean;
  canEdit: boolean;
  storedStateBase64: string | null;
  blocks: EditorBlock[];
  placements: number;
  updatedAt: string;
}

/**
 * Lift a block subtree out of a page into a synced block (Appendix A
 * §1.3 rule 1). The caller replaces the lifted blocks in the page with a
 * placement of the returned id. Nesting synced blocks is refused.
 */
export async function createSyncedBlock(
  sourcePageId: string,
  blocks: EditorBlock[],
): Promise<{ id: string; title: string }> {
  checkDocument(blocks);
  if (blocks.some(containsSyncedBlock)) {
    throw new Error("A synced block cannot contain another synced block");
  }
  const { supabase } = await requireUser();
  const title = titleFromBlocks(blocks);
  const { data, error } = await supabase.rpc("create_synced_block", {
    p_source_page_id: sourcePageId,
    p_title: title,
    p_blocks: blocks as unknown as Json,
  });
  if (error || !data) {
    throw new Error(
      `Could not create synced block: ${error?.message ?? "unknown error"}`,
    );
  }
  return { id: data, title };
}

export async function loadSyncedBlock(
  id: string,
): Promise<SyncedBlockView | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("load_synced_block", {
    p_id: id,
  });
  if (error) throw new Error(`Could not load synced block: ${error.message}`);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title ?? ""),
    sourcePageId: row.source_page_id ? String(row.source_page_id) : null,
    sourceTitle: row.source_title === null ? null : String(row.source_title),
    sourceIcon: row.source_icon === null ? null : String(row.source_icon),
    sourceDeleted: row.source_deleted === true,
    tombstone: row.tombstone === true,
    canEdit: row.can_edit === true,
    storedStateBase64: row.ydoc ? String(row.ydoc) : null,
    blocks: Array.isArray(row.blocks) ? (row.blocks as EditorBlock[]) : [],
    placements: Number(row.placements ?? 0),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/** Persist an edit made through a placement; permission is the source
 *  page's (RLS). `hostPageId` is recorded in the audit event. */
export async function saveSyncedBlock(
  id: string,
  ydocBase64: string,
  blocks: EditorBlock[],
  hostPageId: string,
) {
  if (
    typeof ydocBase64 !== "string" ||
    ydocBase64.length > MAX_YDOC_BASE64_CHARS
  ) {
    throw new Error("Synced block content is too large");
  }
  checkDocument(blocks);
  if (blocks.some(containsSyncedBlock)) {
    throw new Error("A synced block cannot contain another synced block");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_synced_block", {
    p_id: id,
    p_ydoc_base64: ydocBase64,
    p_blocks: blocks as unknown as Json,
    p_host_page_id: hostPageId,
  });
  if (error) throw new Error(`Could not save synced block: ${error.message}`);
}

export interface SyncedBlockSummary {
  id: string;
  title: string;
  sourcePageId: string;
  sourceTitle: string;
  sourceIcon: string | null;
  placements: number;
}

/** Synced blocks the caller can see in a workspace, for the insert picker. */
export async function listSyncedBlocks(
  workspaceId: string,
): Promise<SyncedBlockSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_synced_blocks", {
    p_workspace_id: workspaceId,
  });
  if (error) throw new Error(`Could not list synced blocks: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    sourcePageId: row.source_page_id,
    sourceTitle: row.source_title,
    sourceIcon: row.source_icon,
    placements: Number(row.placements ?? 0),
  }));
}
