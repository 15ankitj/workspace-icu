/**
 * Build the CESR Journey content pack into template snapshots.
 *
 * Usage: npx tsx scripts/build-cesr-pack.ts > /tmp/pack.json \
 *        && mv /tmp/pack.json content/cesr-journey.snapshots.json \
 *        && npx prettier --write content/cesr-journey.snapshots.json
 *
 * Write to a temporary file first: a shell redirect straight onto the
 * snapshots file truncates it before this script reads the previous
 * keys, and every page would get a fresh key.
 *
 * The output is what a "Save as template" of the same pages would have
 * produced; it is inserted as published platform templates (see
 * content/README.md). Page keys are kept from the committed snapshots
 * (matched by template name, page title and parent title) so a rebuilt
 * pack installs as a new *version* of the same templates and "Add the
 * new pages" adds only what is new; pages without a match get a fresh
 * key. Synced blocks travel by their stable keys (Appendix A 1.5).
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  cesrJourney,
  supportingTemplates,
  type PackTemplate,
} from "../content/cesr-journey";
import { flattenDocument } from "../src/lib/blocks";
import { firstPosition, positionAfter } from "../src/lib/position";
import {
  buildSnapshot,
  type SourcePage,
  type SourceSynced,
  type TemplateSnapshot,
} from "../src/lib/templates";

interface Built {
  name: string;
  version?: number;
  snapshot: TemplateSnapshot;
}

/** Existing page keys by "template / parent title / title". */
function existingKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  let previous: Built[] = [];
  try {
    previous = JSON.parse(
      readFileSync(
        new URL("../content/cesr-journey.snapshots.json", import.meta.url),
        "utf8",
      ),
    ) as Built[];
  } catch {
    return keys;
  }
  for (const template of previous) {
    const titles = new Map(
      template.snapshot.pages.map((page) => [page.key, page.title]),
    );
    for (const page of template.snapshot.pages) {
      const parent = page.parent_key ? (titles.get(page.parent_key) ?? "") : "";
      keys.set(`${template.name} / ${parent} / ${page.title}`, page.key);
    }
  }
  return keys;
}

const previousKeys = existingKeys();

function toSnapshot(template: PackTemplate) {
  const titleOf = new Map(template.pages.map((page) => [page.id, page.title]));
  const keyOf = new Map<string, string>();
  for (const page of template.pages) {
    const parent = page.parentId ? (titleOf.get(page.parentId) ?? "") : "";
    keyOf.set(
      page.id,
      previousKeys.get(`${template.name} / ${parent} / ${page.title}`) ??
        randomUUID(),
    );
  }
  const idOf = (id: string) => keyOf.get(id) ?? id;

  // Sibling positions in declaration order.
  const lastByParent = new Map<string | null, string>();
  const pages: SourcePage[] = template.pages.map((page) => {
    const previous = lastByParent.get(page.parentId) ?? null;
    const position = previous ? positionAfter(previous) : firstPosition();
    lastByParent.set(page.parentId, position);
    return {
      id: idOf(page.id),
      parent_page_id: page.parentId ? idOf(page.parentId) : null,
      position,
      title: page.title,
      icon: page.icon,
      cover_url: null,
      full_width: false,
      small_text: false,
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
      newId: () => randomUUID(),
    }),
  };
}

const output = [cesrJourney(), ...supportingTemplates()].map(toSnapshot);
process.stdout.write(JSON.stringify(output));
