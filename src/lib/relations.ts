import { comparePositions, positionBetween } from "@/lib/position";
import {
  normalizeProperties,
  type PageProperties,
  type PagePropertyRow,
} from "@/lib/page-properties";

/**
 * Relation properties (Appendix B): the pure parts. A relation row on a
 * page declares the connection; the pages it holds are `page_relations`
 * rows, one per link, read from both ends. Everything here is shaped for
 * the page route (grouping what it loaded) and the editor (deciding what
 * to send), and unit-tested.
 */

export type RelationRow = Extract<PagePropertyRow, { type: "relation" }>;

const MAX_LABEL = 40;

/** A page as a chip shows it: title, icon, and whether it is in the trash. */
export interface RelationPage {
  id: string;
  title: string;
  icon: string | null;
  trashed: boolean;
}

/** One link seen from the forward side, in property order. */
export interface RelationLink {
  id: string;
  position: string;
  page: RelationPage;
}

/** Forward links by relation row id, each list in stored order. */
export type RelationLinks = Record<string, RelationLink[]>;

/**
 * A link seen from its target: which page holds it, under which row.
 * `properties` is that page's jsonb, so the row's labels can be read.
 */
export interface ReverseLinkRow {
  id: string;
  sourcePropertyId: string;
  source: RelationPage & { properties: unknown };
}

/**
 * The reverse side, grouped by what the connection is called (§4.1 rule
 * 4): every source page whose "Evidence" holds this page appears under
 * one "Evidence for" heading, whatever the id of its row. Links whose
 * source page no longer declares the row are left out.
 */
export interface ReverseGroup {
  /** Stable within a render: the labels, lower-cased. */
  key: string;
  label: string;
  reverseLabel: string;
  links: { id: string; page: RelationPage }[];
}

/** The reverse label a new relation is offered: "Evidence" → "Evidence for". */
export function suggestReverseLabel(label: string): string {
  const base = label.trim();
  if (!base) return "";
  return `${base} for`.slice(0, MAX_LABEL);
}

/** The relation row of a page with this label (case-insensitive), if any. */
export function relationRowByLabel(
  properties: PageProperties,
  label: string,
): RelationRow | null {
  const wanted = label.trim().toLowerCase();
  for (const row of properties.rows) {
    if (row.type === "relation" && row.label.toLowerCase() === wanted) {
      return row;
    }
  }
  return null;
}

export function groupReverseLinks(rows: ReverseLinkRow[]): ReverseGroup[] {
  const groups = new Map<string, ReverseGroup>();
  for (const row of rows) {
    const properties = normalizeProperties(row.source.properties);
    const declared = properties.rows.find(
      (r): r is RelationRow =>
        r.type === "relation" && r.id === row.sourcePropertyId,
    );
    if (!declared) continue;
    const key =
      `${declared.label}\u0000${declared.reverse_label}`.toLowerCase();
    const group = groups.get(key) ?? {
      key,
      label: declared.label,
      reverseLabel: declared.reverse_label,
      links: [],
    };
    group.links.push({
      id: row.id,
      page: {
        id: row.source.id,
        title: row.source.title,
        icon: row.source.icon,
        trashed: row.source.trashed,
      },
    });
    groups.set(key, group);
  }
  const byTitle = (a: { page: RelationPage }, b: { page: RelationPage }) =>
    (a.page.title || "Untitled").localeCompare(b.page.title || "Untitled");
  return [...groups.values()]
    .map((group) => ({ ...group, links: group.links.slice().sort(byTitle) }))
    .sort((a, b) => a.reverseLabel.localeCompare(b.reverseLabel));
}

/** Links in stored order. */
export function sortLinks(links: RelationLink[]): RelationLink[] {
  return links.slice().sort((a, b) => comparePositions(a.position, b.position));
}

/**
 * The position a link takes when dragged from `from` to `to` within its
 * property (indices into the current order). Null when nothing moves.
 */
export function positionForMove(
  links: RelationLink[],
  from: number,
  to: number,
): string | null {
  if (from === to || from < 0 || to < 0) return null;
  if (from >= links.length || to >= links.length) return null;
  const rest = links.filter((_, i) => i !== from);
  const before = to > 0 ? rest[to - 1] : null;
  const after = to < rest.length ? rest[to] : null;
  return positionBetween(before?.position ?? null, after?.position ?? null);
}

/** Relation rows present before and gone after: their links go too. */
export function removedRelationRows(
  before: PageProperties,
  after: PageProperties,
): RelationRow[] {
  const kept = new Set(
    after.rows.filter((r) => r.type === "relation").map((r) => r.id),
  );
  return before.rows.filter(
    (r): r is RelationRow => r.type === "relation" && !kept.has(r.id),
  );
}

/**
 * Links the viewer cannot see, per relation row (§4.2): the total the
 * database reports minus the links RLS returned. Each one renders as
 * "A page you don't have access to", never a title.
 */
export function hiddenLinkCounts(
  totals: { source_property_id: string; total: number }[],
  links: RelationLinks,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { source_property_id: id, total } of totals) {
    const hidden = Math.max(0, total - (links[id]?.length ?? 0));
    if (hidden > 0) out[id] = hidden;
  }
  return out;
}

/** A short line for the collapsed details: "3 Evidence". Hidden links count. */
export function relationSummary(
  rows: PagePropertyRow[],
  links: RelationLinks,
  hidden: Record<string, number> = {},
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.type !== "relation") continue;
    const count = (links[row.id]?.length ?? 0) + (hidden[row.id] ?? 0);
    if (count > 0) out.push(`${count} ${row.label}`);
  }
  return out;
}

/**
 * What the sub-page list shows for one child (§4.6): its relation pages in
 * row order, up to `max` chips, and how many more there are.
 */
export function subPageChips(
  rows: PagePropertyRow[],
  links: RelationLinks,
  max = 3,
): { shown: RelationPage[]; more: number } {
  const all: RelationPage[] = [];
  for (const row of rows) {
    if (row.type !== "relation") continue;
    for (const link of links[row.id] ?? []) all.push(link.page);
  }
  return { shown: all.slice(0, max), more: Math.max(0, all.length - max) };
}

/**
 * The Trash's warning before a purge (§4.3): how many other pages lose a
 * link. Null when none do.
 */
export function purgeUnlinkSentence(
  linkedPages: number,
  withSubPages: boolean,
): string | null {
  if (linkedPages <= 0) return null;
  const subject = withSubPages
    ? "This page and its sub-pages are"
    : "This page is";
  return linkedPages === 1
    ? `${subject} linked from 1 other page; that link will be removed.`
    : `${subject} linked from ${linkedPages} other pages; those links will be removed.`;
}
