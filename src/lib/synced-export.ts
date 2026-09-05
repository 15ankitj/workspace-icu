import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EditorBlock } from "@/lib/blocks";

export type SyncedLookup = (
  id: string,
) => { blocks: EditorBlock[]; sourceTitle: string | null } | null;

/**
 * Load the synced blocks placed on a set of pages, for export and print
 * (Appendix A §1.3 rule 9): each renders as its current content plus a
 * provenance footnote. RLS decides what the caller may load; anything
 * else renders as unavailable, never as content.
 */
export async function loadSyncedForPages(
  supabase: SupabaseClient<Database>,
  pageIds: string[],
): Promise<SyncedLookup> {
  if (pageIds.length === 0) return () => null;
  const { data: embeds } = await supabase
    .from("synced_embeds")
    .select("synced_block_id")
    .in("host_page_id", pageIds);
  const ids = [...new Set((embeds ?? []).map((e) => e.synced_block_id))];
  if (ids.length === 0) return () => null;

  const { data: rows } = await supabase
    .from("synced_blocks")
    .select("id, blocks, source_page_id, deleted_at")
    .in("id", ids)
    .is("deleted_at", null);
  const sourceIds = [
    ...new Set(
      (rows ?? []).flatMap((r) => (r.source_page_id ? [r.source_page_id] : [])),
    ),
  ];
  const { data: sources } = sourceIds.length
    ? await supabase.from("pages").select("id, title").in("id", sourceIds)
    : { data: [] as { id: string; title: string }[] };
  const titleById = new Map((sources ?? []).map((s) => [s.id, s.title]));
  const byId = new Map(
    (rows ?? []).map((r) => [
      r.id,
      {
        blocks: Array.isArray(r.blocks) ? (r.blocks as unknown as EditorBlock[]) : [],
        sourceTitle: r.source_page_id
          ? (titleById.get(r.source_page_id) ?? null)
          : null,
      },
    ]),
  );
  return (id) => byId.get(id) ?? null;
}
