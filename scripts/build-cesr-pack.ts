/**
 * Build the CESR Journey content pack into template snapshots.
 *
 * Usage: npx tsx scripts/build-cesr-pack.ts > content/cesr-journey.snapshots.json
 *
 * The output is what a "Save as template" of the same pages would have
 * produced; it is inserted as published platform templates (see
 * content/README.md). Re-running produces fresh ids, so re-seeding is a
 * new version, never an in-place edit.
 */
import {
  cesrJourney,
  supportingTemplates,
  type PackTemplate,
} from "../content/cesr-journey";
import { flattenDocument } from "../src/lib/blocks";
import { firstPosition, positionAfter } from "../src/lib/position";
import { buildSnapshot, type SourcePage } from "../src/lib/templates";

function toSnapshot(template: PackTemplate) {
  // Sibling positions in declaration order.
  const lastByParent = new Map<string | null, string>();
  const pages: SourcePage[] = template.pages.map((page) => {
    const previous = lastByParent.get(page.parentId) ?? null;
    const position = previous ? positionAfter(previous) : firstPosition();
    lastByParent.set(page.parentId, position);
    return {
      id: page.id,
      parent_page_id: page.parentId,
      position,
      title: page.title,
      icon: page.icon,
      cover_url: null,
      full_width: false,
      small_text: false,
    };
  });
  const blocksByPage = new Map(
    template.pages.map((page) => [
      page.id,
      flattenDocument(page.blocks.flat()),
    ]),
  );
  return {
    name: template.name,
    purpose: template.purpose,
    description: template.description,
    category: template.category,
    audience: template.audience,
    kind: template.kind,
    snapshot: buildSnapshot(pages, blocksByPage, new Map()),
  };
}

const output = [cesrJourney(), ...supportingTemplates()].map(toSnapshot);
process.stdout.write(JSON.stringify(output));
