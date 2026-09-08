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

  it("gives every block a fresh id and keeps parent links within the page", () => {
    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `new-${++n}`,
    });
    const snapshotIds = new Set(
      snapshot.pages.flatMap((p) => p.blocks.map((b) => b.id)),
    );
    for (const page of plan.pages) {
      const ids = new Set(page.blocks.map((b) => b.id));
      expect(ids.size).toBe(page.blocks.length);
      for (const block of page.blocks) {
        expect(snapshotIds.has(block.id)).toBe(false);
        if (block.parent_block_id)
          expect(ids.has(block.parent_block_id)).toBe(true);
      }
    }
    const snapshotParents = snapshot.pages.flatMap(
      (p) => p.blocks.filter((b) => b.parent_block_id).length,
    );
    const planParents = plan.pages.flatMap(
      (p) => p.blocks.filter((b) => b.parent_block_id).length,
    );
    expect(planParents).toEqual(snapshotParents);
  });

  it("instantiates the same snapshot twice without reusing a block id", () => {
    let n = 0;
    const args = {
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `new-${++n}`,
    };
    const first = planInstantiation(args).pages.flatMap((p) =>
      p.blocks.map((b) => b.id),
    );
    const second = planInstantiation(args).pages.flatMap((p) =>
      p.blocks.map((b) => b.id),
    );
    expect(first.some((id) => second.includes(id))).toBe(false);
  });

  it("copes with a snapshot that repeats a block id across pages", () => {
    const repeated = structuredClone(snapshot);
    const shared = repeated.pages[0].blocks[0];
    repeated.pages[1].blocks.push({ ...shared, parent_block_id: null });
    let n = 0;
    const plan = planInstantiation({
      snapshot: repeated,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `new-${++n}`,
    });
    const all = plan.pages.flatMap((p) => p.blocks.map((b) => b.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it("reports missing keys", () => {
    expect(missingPageKeys(snapshot, [A, B])).toEqual([C]);
  });
});

describe("synced blocks in templates (Appendix A rule 8)", () => {
  const S_IN = "11111111-1111-4111-8111-111111111111";
  const S_KEYED = "22222222-2222-4222-8222-222222222222";
  const S_OUT = "33333333-3333-4333-8333-333333333333";
  const placement = (
    id: string,
    syncedId: string,
    position: string,
    readOnly = false,
  ): BlockRowFromDb => ({
    id,
    parent_block_id: null,
    type: "syncedBlock",
    position,
    content: { props: { syncedBlockId: syncedId, readOnly } },
  });
  const content = (text: string) => [
    {
      id: `c-${text}`,
      type: "paragraph",
      props: {},
      content: [{ type: "text", text, styles: {} }],
      children: [{ id: `cc-${text}`, type: "paragraph", props: {} }],
    },
  ];
  const synced = [
    {
      id: S_IN,
      source_page_id: A,
      template_key: null,
      title: "In tree",
      blocks: content("in"),
    },
    {
      id: S_KEYED,
      source_page_id: OUTSIDE,
      template_key: "pack-keyed",
      title: "Keyed",
      blocks: content("keyed"),
    },
    {
      id: S_OUT,
      source_page_id: OUTSIDE,
      template_key: null,
      title: "Outside",
      blocks: content("out"),
    },
  ];
  const rows = new Map<string, BlockRowFromDb[]>([
    [
      A,
      [
        {
          id: "a0",
          parent_block_id: null,
          type: "paragraph",
          position: "a0",
          content: {},
        },
        placement("a1", S_IN, "a1"),
        placement("a2", S_OUT, "a2"),
        {
          id: "a3",
          parent_block_id: null,
          type: "paragraph",
          position: "a3",
          content: {},
        },
      ],
    ],
    [B, [placement("b0", S_IN, "a0", true), placement("b1", S_KEYED, "a1")]],
  ]);
  const snapshot = buildSnapshot(
    [page(A, null, "a0", "A"), page(B, A, "a0", "B")],
    rows,
    new Map(),
    { synced },
  );

  it("keeps in-tree and keyed placements as references, flattens the rest", () => {
    expect(snapshot.format).toBe(3);
    expect(snapshot.synced?.map((s) => [s.key, s.source_key])).toEqual([
      [S_IN, A],
      ["pack-keyed", null],
    ]);
    const a = snapshot.pages[0].blocks;
    expect(a.map((b) => b.type)).toEqual([
      "paragraph",
      "syncedBlock",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(a[1].content?.props?.syncedBlockId).toBe(`synced:${S_IN}`);
    // The flattened copy keeps its own nesting and sits where the
    // placement was, with positions re-issued in order.
    expect(a[3].parent_block_id).toBe(a[2].id);
    const tops = a.filter((b) => !b.parent_block_id).map((b) => b.position);
    expect([...tops].sort()).toEqual(tops);
    expect(new Set(tops).size).toBe(tops.length);
    expect(snapshot.notes).toHaveLength(1);
    expect(snapshot.pages[1].blocks[1].content?.props?.syncedBlockId).toBe(
      "synced:pack-keyed",
    );
    expect(snapshot.pages[1].blocks[0].content?.props?.readOnly).toBe(true);
  });

  it("creates blocks for created sources, reuses keyed ones, flattens unresolved", () => {
    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      existingSyncedByKey: new Map([["pack-keyed", "existing-keyed"]]),
      newId: () => `new-${++n}`,
    });
    expect(plan.synced).toHaveLength(1);
    const created = plan.synced[0];
    expect(created.source_page_id).toBe(plan.pages[0].id);
    expect(created.template_key).toBe(S_IN);
    expect(created.blocks[0].id).not.toBe("c-in");
    expect(created.blocks[0].children?.[0].id).not.toBe("cc-in");
    const a = plan.pages[0].blocks;
    expect(a[1].content?.props?.syncedBlockId).toBe(created.id);
    const b = plan.pages[1].blocks;
    expect(b[0].content?.props?.syncedBlockId).toBe(created.id);
    expect(b[1].content?.props?.syncedBlockId).toBe("existing-keyed");
    expect(plan.notes).toEqual([]);
  });

  it("flattens a keyed placement when the workspace has no such block", () => {
    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `new-${++n}`,
    });
    const b = plan.pages[1].blocks;
    expect(b.map((row) => row.type)).toEqual([
      "syncedBlock",
      "paragraph",
      "paragraph",
    ]);
    expect(JSON.stringify(b)).toContain("keyed");
    expect(plan.notes).toHaveLength(1);
    const ids = b.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves the key off a new block when the workspace already uses it", () => {
    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      existingSyncedByKey: new Map([[S_IN, "older"]]),
      newId: () => `new-${++n}`,
    });
    expect(plan.synced[0].template_key).toBeNull();
    expect(plan.pages[0].blocks[1].content?.props?.syncedBlockId).toBe(
      plan.synced[0].id,
    );
  });

  it("reads format 1 snapshots unchanged", () => {
    const legacy = buildSnapshot([page(A, null, "a0", "A")], blocks, files);
    let n = 0;
    const plan = planInstantiation({
      snapshot: { ...legacy, format: 1, synced: undefined },
      templateId: "t",
      version: 1,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `new-${++n}`,
    });
    expect(plan.synced).toEqual([]);
    expect(plan.pages).toHaveLength(1);
  });
});

describe("authored content in templates (Appendix A §2.2)", () => {
  it("snapshots and instantiates the flag, defaulting to off", () => {
    const authored = { ...page(A, null, "a0", "A"), authored_content: true };
    const snapshot = buildSnapshot(
      [authored, page(B, A, "a1", "B")],
      new Map(),
      new Map(),
    );
    expect(snapshot.format).toBe(3);
    expect(snapshot.pages.map((p) => p.authored_content)).toEqual([
      true,
      false,
    ]);

    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 3,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `id-${++n}`,
    });
    expect(plan.pages.map((p) => p.authored_content)).toEqual([true, false]);
  });

  it("reads older snapshots as direct-edit", () => {
    const snapshot = buildSnapshot(
      [page(A, null, "a0", "A")],
      new Map(),
      new Map(),
    );
    const older = { ...snapshot, format: 2 as const };
    older.pages = older.pages.map((p) => {
      const copy = { ...p };
      delete copy.authored_content;
      return copy;
    });
    const plan = planInstantiation({
      snapshot: older,
      templateId: "t",
      version: 2,
      workspaceId: "w",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => "id-1",
    });
    expect(plan.pages[0].authored_content).toBe(false);
  });
});
