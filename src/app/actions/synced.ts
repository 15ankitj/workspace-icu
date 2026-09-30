"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  ok,
  runAction,
  type ActionFailure,
  type ActionResult,
} from "@/lib/action-result";
import {
  flattenDocument,
  MAX_BLOCKS_PER_PAGE,
  MAX_DOCUMENT_BYTES,
  type EditorBlock,
} from "@/lib/blocks";
import {
  containsSyncedBlock,
  roomIdForSyncedBlock,
  titleFromBlocks,
} from "@/lib/synced";
import { deleteLiveblocksRoom } from "@/lib/liveblocks-admin";
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

/** The reason a document cannot be stored, or null when it can. */
function checkDocument(document: EditorBlock[]): ActionFailure | null {
  if (!Array.isArray(document)) return fail("Invalid document");
  const rows = flattenDocument(document);
  if (rows.length > MAX_BLOCKS_PER_PAGE) {
    return fail(`Synced blocks are limited to ${MAX_BLOCKS_PER_PAGE} blocks`);
  }
  if (JSON.stringify(document).length > MAX_DOCUMENT_BYTES) {
    return fail("Synced block content is too large");
  }
  if (document.some(containsSyncedBlock)) {
    return fail("A synced block cannot contain another synced block");
  }
  return null;
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
  /** The source page is authored content: only its author edits it,
   *  through any placement (Appendix A §2.5). */
  sourceAuthored: boolean;
  /** This user authors the source page. */
  sourceIsAuthor: boolean;
  /** Authored source, editor rights, not an author: suggest instead. */
  canSuggest: boolean;
  tombstone: boolean;
  deletedAt: string | null;
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
): Promise<ActionResult<{ id: string; title: string }>> {
  return runAction(async () => {
    const invalid = checkDocument(blocks);
    if (invalid) return invalid;
    const { supabase } = await requireUser();
    const title = titleFromBlocks(blocks);
    const { data, error } = await supabase.rpc("create_synced_block", {
      p_source_page_id: sourcePageId,
      p_title: title,
      p_blocks: blocks as unknown as Json,
    });
    if (error) return fromSupabaseError(error);
    if (!data) return fail("Could not create the synced block");
    return ok({ id: data, title });
  });
}

/** `view` is null for a visitor without a session or a block the caller
 *  cannot see: public share pages render placements too (Appendix A
 *  §1.3 rule 6) and get the neutral placeholder, never a bounce. */
export async function loadSyncedBlock(
  id: string,
): Promise<ActionResult<{ view: SyncedBlockView | null }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return ok({ view: null });
    const { data, error } = await supabase.rpc("load_synced_block", {
      p_id: id,
    });
    if (error) return fromSupabaseError(error);
    if (!data) return ok({ view: null });
    const row = data as Record<string, unknown>;
    return ok({
      view: {
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        title: String(row.title ?? ""),
        sourcePageId: row.source_page_id ? String(row.source_page_id) : null,
        sourceTitle:
          row.source_title === null ? null : String(row.source_title),
        sourceIcon: row.source_icon === null ? null : String(row.source_icon),
        sourceDeleted: row.source_deleted === true,
        sourceAuthored: row.source_authored === true,
        sourceIsAuthor: row.source_is_author === true,
        canSuggest: row.can_suggest === true,
        tombstone: row.tombstone === true,
        deletedAt: row.deleted_at ? String(row.deleted_at) : null,
        canEdit: row.can_edit === true,
        storedStateBase64: row.ydoc ? String(row.ydoc) : null,
        blocks: Array.isArray(row.blocks) ? (row.blocks as EditorBlock[]) : [],
        placements: Number(row.placements ?? 0),
        updatedAt: String(row.updated_at ?? ""),
      },
    });
  });
}

/** Persist an edit made through a placement; permission is the source
 *  page's (RLS). `hostPageId` is recorded in the audit event. */
export async function saveSyncedBlock(
  id: string,
  ydocBase64: string,
  blocks: EditorBlock[],
  hostPageId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    if (
      typeof ydocBase64 !== "string" ||
      ydocBase64.length > MAX_YDOC_BASE64_CHARS
    ) {
      return fail("Synced block content is too large");
    }
    const invalid = checkDocument(blocks);
    if (invalid) return invalid;
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("save_synced_block", {
      p_id: id,
      p_ydoc_base64: ydocBase64,
      p_blocks: blocks as unknown as Json,
      p_host_page_id: hostPageId,
    });
    if (error) return fromSupabaseError(error);
    return ok();
  });
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
): Promise<ActionResult<{ blocks: SyncedBlockSummary[] }>> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("list_synced_blocks", {
      p_workspace_id: workspaceId,
    });
    if (error) return fromSupabaseError(error);
    return ok({
      blocks: (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        sourcePageId: row.source_page_id,
        sourceTitle: row.source_title,
        sourceIcon: row.source_icon,
        placements: Number(row.placements ?? 0),
      })),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Deletion flows (Appendix A §1.3 rules 6 and 7).                     */
/* ------------------------------------------------------------------ */

/**
 * "Delete everywhere": tombstone the synced block. Content is cleared
 * here and in its collaborative room; placements on other pages show
 * what was lost and when until their owners remove them.
 */
export async function deleteSyncedBlockEverywhere(
  id: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("delete_synced_block", { p_id: id });
    if (error) return fromSupabaseError(error);
    // Best effort: the nightly job retries rooms that are still there.
    await deleteLiveblocksRoom(roomIdForSyncedBlock(id));
    return ok();
  });
}

/** "Choose a new source": a page already hosting a placement takes over
 *  as the source, so permission and provenance follow it. */
export async function reassignSyncedSource(
  id: string,
  newSourcePageId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("reassign_synced_source", {
      p_id: id,
      p_new_source_page_id: newSourcePageId,
    });
    if (error) return fromSupabaseError(error);
    return ok();
  });
}

export interface SyncedHostPage {
  pageId: string;
  title: string;
  icon: string | null;
  isPrivate: boolean;
}

/** Host pages (that the caller can see) which could become the source. */
export async function listSyncedHosts(
  id: string,
): Promise<ActionResult<{ hosts: SyncedHostPage[] }>> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("list_synced_hosts", {
      p_id: id,
    });
    if (error) return fromSupabaseError(error);
    return ok({
      hosts: (data ?? []).map((row) => ({
        pageId: row.page_id,
        title: row.title,
        icon: row.icon,
        isPrivate: row.is_private,
      })),
    });
  });
}
