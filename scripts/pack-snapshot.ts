/**
 * Turn a content pack template (content/cesr-journey.ts) into the shape
 * the gallery installs: template metadata plus a snapshot from
 * `buildSnapshot`, as a "Save as template" of the same pages would have
 * produced. Pure apart from `newId`, so it is unit-tested; the CLI in
 * build-cesr-pack.ts reads the previous keys and prints the JSON.
 *
 * Page keys are kept from the previous build (matched by template name,
 * page title and parent title) so a rebuilt pack installs as a new
 * *version* of the same templates and "Add the new pages" adds only what
 * is new; pages without a match get a fresh key. Synced blocks travel by
 * their stable keys (Appendix A §1.5); page properties and relation
 * links travel as snapshot format 4 (Appendix B §4.5).
 */
import { randomUUID } from "node:crypto";
import type { PackTemplate } from "../content/cesr-journey";
import { flattenDocument } from "../src/lib/blocks";
import { propertiesForTemplate } from "../src/lib/page-properties";
import { firstPosition, positionAfter } from "../src/lib/position";
import {
  buildSnapshot,
  type SourcePage,
  type SourceRelation,
  type SourceSynced,
  type TemplateSnapshot,
} from "../src/lib/templates";

/** One entry of the built pack file. */
export interface BuiltTemplate {
  name: string;
  purpose: string;
  description: string;
  category: string;
  audience: string;
  kind: PackTemplate["kind"];
  version: number;
  changelog: string;
  snapshot: TemplateSnapshot;
}

/** The database limit on `pages.description` (migration 0014). */
const MAX_DESCRIPTION = 500;

/** Key of a page for matching across builds. */
function pageKeyPath(template: string, parent: string, title: string) {
  return `${template} / ${parent} / ${title}`;
}

/**
 * Page keys of a previous build by "template / parent title / title", so
 * the next build reuses them. Accepts whatever the snapshots file held,
 * including older formats.
 */
export function previousKeysOf(
  previous: { name: string; snapshot: { pages: TemplateSnapshot["pages"] } }[],
): Map<string, string> {
  const keys = new Map<string, string>();
  for (const template of previous) {
    const titles = new Map(
      template.snapshot.pages.map((page) => [page.key, page.title]),
    );
    for (const page of template.snapshot.pages) {
      const parent = page.parent_key ? (titles.get(page.parent_key) ?? "") : "";
      keys.set(pageKeyPath(template.name, parent, page.title), page.key);
    }
  }
  return keys;
}

class PackError extends Error {
  constructor(template: string, message: string) {
    super(`${template}: ${message}`);
    this.name = "PackError";
  }
}

/**
 * Build one template. Throws a `PackError` naming the template when the
 * pack is malformed: a property row the app would drop (bad id, duplicate
 * id), a description over the database limit, or a relation whose pages
 * or property row are not in the template — a pack must never ship a
 * dangling link, so these are errors rather than the notes `buildSnapshot`
 * makes for a saved page tree.
 */
export function packToSnapshot(
  template: PackTemplate,
  previousKeys: Map<string, string> = new Map(),
  newId: () => string = () => randomUUID(),
): BuiltTemplate {
  const fail = (message: string): never => {
    throw new PackError(template.name, message);
  };
  const byId = new Map(template.pages.map((page) => [page.id, page]));
  if (byId.size !== template.pages.length) fail("duplicate page id");

  const keyOf = new Map<string, string>();
  for (const page of template.pages) {
    const parent = page.parentId ? (byId.get(page.parentId)?.title ?? "") : "";
    keyOf.set(
      page.id,
      previousKeys.get(pageKeyPath(template.name, parent, page.title)) ??
        newId(),
    );
  }
  const idOf = (id: string) => keyOf.get(id) ?? id;

  // Sibling positions in declaration order.
  const lastByParent = new Map<string | null, string>();
  const pages: SourcePage[] = template.pages.map((page) => {
    const previous = lastByParent.get(page.parentId) ?? null;
    const position = previous ? positionAfter(previous) : firstPosition();
    lastByParent.set(page.parentId, position);

    const rows = page.properties ?? [];
    const properties = { hidden: [], rows };
    const kept = propertiesForTemplate(properties).rows.map((row) => row.id);
    if (kept.length !== rows.length) {
      const dropped = rows
        .map((row) => row.id)
        .filter(
          (id, index, all) => !kept.includes(id) || all.indexOf(id) !== index,
        );
      fail(
        `page “${page.title}” has property rows the app would drop (bad or duplicate id): ${dropped.join(", ")}`,
      );
    }
    const description = page.description ?? "";
    if (description.length > MAX_DESCRIPTION) {
      fail(
        `page “${page.title}” has a description of ${description.length} characters; the limit is ${MAX_DESCRIPTION}`,
      );
    }
    return {
      id: idOf(page.id),
      parent_page_id: page.parentId ? idOf(page.parentId) : null,
      position,
      title: page.title,
      icon: page.icon,
      cover_url: null,
      full_width: false,
      small_text: false,
      description,
      properties,
      authored_content: page.authored === true,
    };
  });

  // Page links in content use the authoring ids; rewrite them to the keys.
  const blocksByPage = new Map(
    template.pages.map((page) => [
      idOf(page.id),
      JSON.parse(
        JSON.stringify(flattenDocument(page.blocks.flat())).replace(
          /"pageId":"([0-9a-f-]{36})"/gi,
          (match, id: string) => `"pageId":"${idOf(id)}"`,
        ),
      ) as ReturnType<typeof flattenDocument>,
    ]),
  );

  const synced: SourceSynced[] = (template.synced ?? []).map((entry) => ({
    id: entry.id,
    source_page_id: entry.sourcePageId ? idOf(entry.sourcePageId) : null,
    template_key: entry.key,
    title: entry.title,
    blocks: entry.blocks,
  }));

  // Relation links: authoring ids to keys, positions per (source page,
  // property) in declaration order, every reference checked.
  const lastByProperty = new Map<string, string>();
  const relations: SourceRelation[] = (template.relations ?? []).map((link) => {
    const source = byId.get(link.sourcePageId);
    const target = byId.get(link.targetPageId);
    if (!source) fail(`relation from unknown page ${link.sourcePageId}`);
    if (!target) {
      fail(
        `relation “${link.propertyId}” on page “${source!.title}” points at a page outside the template (${link.targetPageId})`,
      );
    }
    if (link.sourcePageId === link.targetPageId) {
      fail(`page “${source!.title}” cannot relate to itself`);
    }
    const row = (source!.properties ?? []).find(
      (r) => r.id === link.propertyId,
    );
    if (!row || row.type !== "relation") {
      fail(
        `page “${source!.title}” has no relation property “${link.propertyId}”`,
      );
    }
    const slot = `${link.sourcePageId}\u0000${link.propertyId}`;
    const previous = lastByProperty.get(slot) ?? null;
    const position = previous ? positionAfter(previous) : firstPosition();
    lastByProperty.set(slot, position);
    return {
      source_page_id: idOf(link.sourcePageId),
      source_property_id: link.propertyId,
      target_page_id: idOf(link.targetPageId),
      position,
    };
  });

  return {
    name: template.name,
    purpose: template.purpose,
    description: template.description,
    category: template.category,
    audience: template.audience,
    kind: template.kind,
    version: template.version,
    changelog: template.changelog,
    snapshot: buildSnapshot(pages, blocksByPage, new Map(), {
      synced,
      relations,
      newId,
    }),
  };
}
