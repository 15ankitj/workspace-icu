import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EditorBlock } from "@/lib/blocks";
import { suggestionIdsIn } from "@/lib/suggestion-markup";
import { suggesterPrefix } from "@/lib/suggestions";
import { ydocToBlocks } from "@/lib/ydoc-blocks";

/**
 * Everything a "with markup" export needs beyond the clean projection
 * (Appendix A §2.4): each page's document read from its stored Yjs state
 * with suggestion markup intact, the same for the synced blocks placed on
 * those pages, and the display names behind the suggestion ids. All of it
 * is read through RLS; a page whose Yjs state the caller cannot read (or
 * that has never been saved collaboratively) falls back to its clean
 * projection.
 */

export interface MarkupExport {
  /** Marked-up document per page, when one could be read. */
  pageBlocks: Map<string, EditorBlock[]>;
  /** Marked-up content per synced block, when one could be read. */
  syncedBlocks: Map<string, EditorBlock[]>;
  /** Display name for a suggestion id, from the suggester's user id. */
  suggester: (suggestionId: string) => string | null;
}

/** PostgREST returns bytea as "\\x…" hex; RPCs return base64. */
export function bytesFrom(value: string | null | undefined): Uint8Array | null {
  if (!value) return null;
  if (value.startsWith("\\x")) {
    const hex = value.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

function blocksOrNull(bytes: Uint8Array | null): EditorBlock[] | null {
  if (!bytes || bytes.length === 0) return null;
  try {
    return ydocToBlocks(bytes);
  } catch {
    return null;
  }
}

export async function loadMarkupExport(
  supabase: SupabaseClient<Database>,
  pageIds: string[],
  syncedIds: string[],
): Promise<MarkupExport> {
  const pageBlocks = new Map<string, EditorBlock[]>();
  await Promise.all(
    pageIds.map(async (pageId) => {
      const { data } = await supabase.rpc("load_page_document", {
        p_page_id: pageId,
      });
      const blocks = blocksOrNull(bytesFrom(data));
      if (blocks) pageBlocks.set(pageId, blocks);
    }),
  );

  const syncedBlocks = new Map<string, EditorBlock[]>();
  if (syncedIds.length) {
    const { data: rows } = await supabase
      .from("synced_blocks")
      .select("id, ydoc")
      .in("id", syncedIds)
      .is("deleted_at", null);
    for (const row of rows ?? []) {
      const blocks = blocksOrNull(bytesFrom(row.ydoc));
      if (blocks) syncedBlocks.set(row.id, blocks);
    }
  }

  // Names: suggestion ids carry the first 8 hex of the suggester's user
  // id, and the suggestion rows (members only, under RLS) give the rest.
  const ids = new Set<string>();
  for (const blocks of pageBlocks.values())
    for (const id of suggestionIdsIn(blocks)) ids.add(id);
  for (const blocks of syncedBlocks.values())
    for (const id of suggestionIdsIn(blocks)) ids.add(id);
  const nameByPrefix = new Map<string, string>();
  if (ids.size) {
    const { data: rows } = await supabase
      .from("page_suggestions")
      .select(
        "id, suggester:users!page_suggestions_suggester_id_fkey(id, display_name)",
      )
      .in("id", [...ids]);
    for (const row of rows ?? []) {
      const user = row.suggester as { id: string; display_name: string } | null;
      if (user) nameByPrefix.set(user.id.slice(0, 8), user.display_name);
    }
  }
  return {
    pageBlocks,
    syncedBlocks,
    suggester: (id) => {
      const prefix = suggesterPrefix(id);
      return prefix ? (nameByPrefix.get(prefix) ?? null) : null;
    },
  };
}

/** Unresolved suggestions per page (open, or stale and awaiting a
 *  decision), for the warning every clean export carries (§2.4). */
export async function unresolvedSuggestionCounts(
  supabase: SupabaseClient<Database>,
  pageIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (pageIds.length === 0) return counts;
  const { data } = await supabase
    .from("page_suggestions")
    .select("page_id")
    .in("page_id", pageIds)
    .in("status", ["open", "stale"]);
  for (const row of data ?? []) {
    counts.set(row.page_id, (counts.get(row.page_id) ?? 0) + 1);
  }
  return counts;
}

/** The note that accompanies an export: which included pages still have
 *  suggestions waiting, and whether this export shows them. */
export function exportNotes(
  pages: { id: string; title: string }[],
  counts: Map<string, number>,
  markup: boolean,
): string | null {
  const affected = pages.filter((p) => (counts.get(p.id) ?? 0) > 0);
  if (affected.length === 0) return null;
  const total = affected.reduce((n, p) => n + (counts.get(p.id) ?? 0), 0);
  const lines = [
    "# Export notes",
    "",
    markup
      ? `This export includes suggestion markup. ${total} suggestion${total === 1 ? "" : "s"} on ${affected.length} page${affected.length === 1 ? "" : "s"} ${total === 1 ? "is" : "are"} still unresolved; inserted text is wrapped in <ins>, deleted text in <del>, and a suggested block is preceded by a "Suggested …" line.`
      : `${total} suggestion${total === 1 ? "" : "s"} on ${affected.length} page${affected.length === 1 ? "" : "s"} ${total === 1 ? "is" : "are"} still unresolved. This export is the clean state: suggested insertions are left out and suggested deletions remain as the author's text. Resolve them in the app before submitting this export as a record.`,
    "",
    ...affected.map(
      (p) => `- ${p.title || "Untitled"}: ${counts.get(p.id)} unresolved`,
    ),
    "",
  ];
  return lines.join("\n");
}
