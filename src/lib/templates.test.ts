import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  missingPageKeys,
  planInstantiation,
  type SourcePage,
} from "@/lib/templates";
import type { BlockRowFromDb } from "@/lib/blocks";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OUTSIDE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FILE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function page(
  id: string,
  parent: string | null,
  position: string,
  title: string,
): SourcePage {
  return {
    id,
    parent_page_id: parent,
    position,
    title,
    icon: null,
    cover_url: null,
    full_width: false,
    small_text: false,
  };
}

const blocks = new Map<string, BlockRowFromDb[]>([
  [
    A,
    [
      {
        id: "a1",
        parent_block_id: null,
        type: "pageLink",
        position: "a0",
        content: { props: { pageId: B, title: "B" } },
      },
      {
        id: "a2",
        parent_block_id: null,
        type: "paragraph",
        position: "a1",
        content: {
          content: [
            { type: "pageMention", props: { pageId: OUTSIDE, title: "Out" } },
          ],
        },
      },
      {
        id: "a3",
        parent_block_id: null,
        type: "image",
        position: "a2",
        content: { props: { url: `/api/files/${FILE}`, caption: "" } },
      },
    ],
  ],
  [B, []],
  [C, []],
]);

const files = new Map([
  [FILE, { filename: "scan.png", mime: "image/png", size_bytes: 1234 }],
]);

describe("buildSnapshot", () => {
  it("orders parents first, rewrites internal links and files, keeps external links", () => {
    const snapshot = buildSnapshot(
      [page(C, A, "a0", "C"), page(A, null, "a0", "A"), page(B, A, "a1", "B")],
      blocks,
      files,
    );
    expect(snapshot.pages.map((p) => p.key)).toEqual([A, C, B]);
    expect(snapshot.pages[0].parent_key).toBeNull();
    expect(snapshot.pages[1].parent_key).toBe(A);

    const text = JSON.stringify(snapshot.pages[0].blocks);
    expect(text).toContain(`"pageId":"key:${B}"`);
    expect(text).toContain(`"pageId":"${OUTSIDE}"`);
    expect(text).toContain(`file:${FILE}`);
    expect(snapshot.files).toEqual([
      { key: FILE, filename: "scan.png", mime: "image/png", size_bytes: 1234 },
    ]);
  });
});

describe("planInstantiation", () => {
  const snapshot = buildSnapshot(
    [page(A, null, "a0", "A"), page(B, A, "a1", "B"), page(C, A, "a0", "C")],
    blocks,
    files,
  );

  it("creates every page with fresh ids, remapped links and copied files", () => {
    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: "a5",
      newId: () => `new-${++n}`,
    });
    expect(plan.pages).toHaveLength(3);
    const root = plan.pages[0];
    expect(root.parent_page_id).toBeNull();
    expect(root.position > "a5").toBe(true);
    expect(root.template_page_key).toBe(A);
    expect(plan.rootPageId).toBe(root.id);

    const childB = plan.pages.find((p) => p.template_page_key === B)!;
    expect(childB.parent_page_id).toBe(root.id);
    const text = JSON.stringify(root.blocks);
    expect(text).toContain(`"pageId":"${childB.id}"`);
    expect(text).toContain(`"pageId":"${OUTSIDE}"`);
    expect(plan.files).toHaveLength(1);
    expect(text).toContain(`/api/files/${plan.files[0].newId}`);
    expect(plan.files[0].pageId).toBe(root.id);
  });

  it("adds only missing pages under existing copies", () => {
    let n = 0;
    const existing = new Map([[A, "existing-root"]]);
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 2,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      existingByKey: existing,
      newId: () => `new-${++n}`,
    });
    expect(plan.pages.map((p) => p.template_page_key).sort()).toEqual(
      [B, C].sort(),
    );
    for (const p of plan.pages) expect(p.parent_page_id).toBe("existing-root");
    expect(plan.rootPageId).toBeNull();
  });

  it("reports missing keys", () => {
    expect(missingPageKeys(snapshot, [A, B])).toEqual([C]);
  });
});
