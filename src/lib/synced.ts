import type { EditorBlock } from "@/lib/blocks";

/**
 * Synced blocks (Appendix A, Part 1): one identity, many placements. The
 * content lives in its own collaborative document, keyed by the synced
 * block id; every placement — the source page's included — is an editor
 * block of type `syncedBlock` carrying only the reference. Pure helpers
 * shared by the editor, the room-token route and the save path.
 */

export const SYNCED_BLOCK_TYPE = "syncedBlock";

/** Distinct sources one page may host live; beyond this, embeds render a
 *  read-only snapshot with a refresh affordance (brief §1.4, proposed 20). */
export const MAX_LIVE_SYNCED_SOURCES = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function roomIdForSyncedBlock(id: string): string {
  return `synced:${id}`;
}

export function syncedBlockIdFromRoomId(roomId: string): string | null {
  if (!roomId.startsWith("synced:")) return null;
  const id = roomId.slice("synced:".length);
  return UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

/** What goes on the clipboard for "Copy as synced block"; pasting it
 *  anywhere in the app inserts a placement. */
export const SYNCED_CLIPBOARD_PREFIX = "workspaceicu:synced:";

export function syncedClipboardText(id: string): string {
  return `${SYNCED_CLIPBOARD_PREFIX}${id}`;
}

export function parseSyncedClipboardText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(SYNCED_CLIPBOARD_PREFIX)) return null;
  const id = trimmed.slice(SYNCED_CLIPBOARD_PREFIX.length);
  return UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

export interface SyncedPlacementProps {
  syncedBlockId: string;
  readOnly: boolean;
}

export function placementProps(
  block: EditorBlock,
): SyncedPlacementProps | null {
  if (block.type !== SYNCED_BLOCK_TYPE) return null;
  const id = String(block.props?.syncedBlockId ?? "");
  if (!UUID_PATTERN.test(id)) return null;
  return {
    syncedBlockId: id.toLowerCase(),
    readOnly: block.props?.readOnly === true,
  };
}

/** Distinct synced block ids referenced anywhere in a document, in
 *  document order — the first N are the ones that go live. */
export function syncedBlockIdsIn(document: EditorBlock[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (blocks: EditorBlock[]) => {
    for (const block of blocks) {
      const placement = placementProps(block);
      if (placement && !seen.has(placement.syncedBlockId)) {
        seen.add(placement.syncedBlockId);
        out.push(placement.syncedBlockId);
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(document);
  return out;
}

/** True when the block or any descendant is a synced placement — nesting
 *  synced blocks is not permitted in this iteration (brief §1.2). */
export function containsSyncedBlock(block: EditorBlock): boolean {
  if (block.type === SYNCED_BLOCK_TYPE) return true;
  return (block.children ?? []).some(containsSyncedBlock);
}

/** A short label for a synced block, from its first text. */
export function titleFromBlocks(blocks: EditorBlock[], max = 80): string {
  const texts: string[] = [];
  const collect = (value: unknown) => {
    if (texts.join(" ").length > max) return;
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.text === "string") texts.push(record.text);
      for (const key of ["content", "children", "rows", "cells"]) {
        if (key in record) collect(record[key]);
      }
    }
  };
  collect(blocks);
  const joined = texts.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return "Synced block";
  return joined.length > max
    ? `${joined.slice(0, max - 1).trimEnd()}…`
    : joined;
}

/* ------------------------------------------------------------------ */
/* Deletion flows (Appendix A §1.3 rules 6 and 7).                     */
/* ------------------------------------------------------------------ */

/** The shape of a BlockNote change we care about, kept structural so the
 *  helper is testable without the editor. */
export interface PlacementChange {
  type: string;
  source: { type: string };
  block: { type: string; props?: Record<string, unknown>; children?: unknown };
}

/**
 * Synced block ids whose placements this user just removed from the
 * document — by deleting, cutting, undoing or replacing them — nested
 * placements included. Remote (Yjs) changes are somebody else's edit and
 * are never attributed to this user.
 */
export function locallyRemovedPlacementIds(
  changes: PlacementChange[],
): string[] {
  const out = new Set<string>();
  for (const change of changes) {
    if (change.type !== "delete" || change.source.type === "yjs-remote") {
      continue;
    }
    for (const id of syncedBlockIdsIn([change.block as EditorBlock])) {
      out.add(id);
    }
  }
  return [...out];
}

/** Purge-time decision for a synced block whose source page is going:
 *  "delete" (tombstone), or the id of the host page that becomes the source. */
export const PURGE_DELETE = "delete";

export type PurgeDecision = typeof PURGE_DELETE | string;

/**
 * Parse the decisions posted by the Trash's purge dialog: a JSON object
 * of synced block id → "delete" | host page id. Unknown ids are ignored
 * and anything unrecognised means delete, which is what happens anyway.
 */
export function parsePurgeDecisions(
  raw: string | null | undefined,
  allowedIds: Iterable<string>,
): Map<string, PurgeDecision> {
  const allowed = new Set(allowedIds);
  const out = new Map<string, PurgeDecision>();
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return out;
  }
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!allowed.has(id)) continue;
    out.set(
      id,
      typeof value === "string" && UUID_PATTERN.test(value)
        ? value.toLowerCase()
        : PURGE_DELETE,
    );
  }
  return out;
}
