import type { createClient } from "@/lib/supabase/server";
import { flags } from "@/lib/flags";
import {
  groupReverseLinks,
  sortLinks,
  type RelationLinks,
  type ReverseGroup,
  type ReverseLinkRow,
} from "@/lib/relations";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** One-to-many embeds arrive as an object or a one-element array. */
export function embedded<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export interface PageRelations {
  /** Forward links by page id, then by relation row id, in stored order. */
  forward: Map<string, RelationLinks>;
  /** The reverse side by page id, grouped by label. */
  reverse: Map<string, ReverseGroup[]>;
}

const EMPTY: PageRelations = { forward: new Map(), reverse: new Map() };

/**
 * The relation links of many pages at once, for exports and the sub-page
 * list. Read through the caller's RLS: a link to or from a page they
 * cannot see is left out (the export philosophy, "only what the caller
 * can see"), so exports carry no placeholder and no count. Nothing is
 * loaded while the `relations` flag is off.
 */
export async function loadRelationsForPages(
  supabase: Supabase,
  pageIds: string[],
): Promise<PageRelations> {
  if (!flags.relations || pageIds.length === 0) return EMPTY;
  const [{ data: forwardRows }, { data: reverseRows }] = await Promise.all([
    supabase
      .from("page_relations")
      .select(
        "id, source_page_id, source_property_id, position, target:pages!page_relations_target_page_id_fkey(id, title, icon, deleted_at)",
      )
      .in("source_page_id", pageIds),
    supabase
      .from("page_relations")
      .select(
        "id, target_page_id, source_property_id, source:pages!page_relations_source_page_id_fkey(id, title, icon, deleted_at, properties)",
      )
      .in("target_page_id", pageIds),
  ]);

  const forward = new Map<string, RelationLinks>();
  for (const row of forwardRows ?? []) {
    const target = embedded(row.target);
    if (!target) continue;
    const byRow = forward.get(row.source_page_id) ?? {};
    (byRow[row.source_property_id] ??= []).push({
      id: row.id,
      position: row.position,
      page: {
        id: target.id,
        title: target.title,
        icon: target.icon,
        trashed: target.deleted_at !== null,
      },
    });
    forward.set(row.source_page_id, byRow);
  }
  for (const byRow of forward.values()) {
    for (const key of Object.keys(byRow)) byRow[key] = sortLinks(byRow[key]);
  }

  const reverseRowsByPage = new Map<string, ReverseLinkRow[]>();
  for (const row of reverseRows ?? []) {
    const source = embedded(row.source);
    if (!source) continue;
    const list = reverseRowsByPage.get(row.target_page_id) ?? [];
    list.push({
      id: row.id,
      sourcePropertyId: row.source_property_id,
      source: {
        id: source.id,
        title: source.title,
        icon: source.icon,
        trashed: source.deleted_at !== null,
        properties: source.properties,
      },
    });
    reverseRowsByPage.set(row.target_page_id, list);
  }
  const reverse = new Map<string, ReverseGroup[]>();
  for (const [pageId, rows] of reverseRowsByPage) {
    reverse.set(pageId, groupReverseLinks(rows));
  }
  return { forward, reverse };
}

/** Display names of a workspace's members, for people rows in exports. */
export async function loadMemberNames(
  supabase: Supabase,
  workspaceId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, users (display_name)")
    .eq("workspace_id", workspaceId);
  return new Map(
    (data ?? []).map((m) => [m.user_id, m.users?.display_name ?? "Unknown"]),
  );
}
