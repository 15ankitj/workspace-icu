import { describe, expect, it } from "vitest";
import {
  buildDocument,
  flattenDocument,
  type BlockRowFromDb,
  type EditorBlock,
} from "@/lib/blocks";

const doc: EditorBlock[] = [
  {
    id: "b1",
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "Title", styles: {} }],
    children: [],
  },
  {
    id: "b2",
    type: "bulletListItem",
    props: {},
    content: [{ type: "text", text: "Parent", styles: {} }],
    children: [
      {
        id: "b3",
        type: "bulletListItem",
        props: {},
        content: [{ type: "text", text: "Child", styles: {} }],
        children: [
          {
            id: "b4",
            type: "checkListItem",
            props: { checked: true },
            content: [],
            children: [],
          },
        ],
      },
    ],
  },
  { id: "b5", type: "divider", props: {}, children: [] },
];

describe("flattenDocument", () => {
  it("emits parents before their children", () => {
    const rows = flattenDocument(doc);
    const index = new Map(rows.map((r, i) => [r.id, i]));
    for (const row of rows) {
      if (row.parent_block_id) {
        expect(index.get(row.parent_block_id)!).toBeLessThan(
          index.get(row.id)!,
        );
      }
    }
  });

  it("orders siblings by ascending fractional position", () => {
    const rows = flattenDocument(doc);
    const roots = rows.filter((r) => r.parent_block_id === null);
    expect(roots.map((r) => r.id)).toEqual(["b1", "b2", "b5"]);
    const sorted = roots
      .slice()
      .sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(sorted.map((r) => r.id)).toEqual(["b1", "b2", "b5"]);
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      flattenDocument([
        { id: "x", type: "paragraph" },
        { id: "x", type: "paragraph" },
      ]),
    ).toThrow(/unique/);
  });

  it("preserves props and inline content", () => {
    const rows = flattenDocument(doc);
    const b4 = rows.find((r) => r.id === "b4")!;
    expect(b4.content).toEqual({ props: { checked: true }, content: [] });
    const b5 = rows.find((r) => r.id === "b5")!;
    expect(b5.content).toEqual({ props: {} });
  });
});

describe("buildDocument", () => {
  it("round-trips flattenDocument output", () => {
    const rows = flattenDocument(doc) as BlockRowFromDb[];
    // Shuffle to prove ordering comes from positions, not row order.
    const shuffled = [rows[3], rows[0], rows[4], rows[2], rows[1]];
    const rebuilt = buildDocument(shuffled);

    const normalise = (blocks: EditorBlock[]): unknown =>
      blocks.map((b) => ({
        id: b.id,
        type: b.type,
        props: b.props,
        content: b.content,
        children: normalise(b.children ?? []),
      }));
    expect(normalise(rebuilt)).toEqual(normalise(doc));
  });

  it("degrades an orphaned child to a root block", () => {
    const rows: BlockRowFromDb[] = [
      {
        id: "a",
        parent_block_id: "missing",
        type: "paragraph",
        position: "a0",
        content: {},
      },
    ];
    expect(buildDocument(rows).map((b) => b.id)).toEqual(["a"]);
  });

  it("handles an empty page", () => {
    expect(buildDocument([])).toEqual([]);
  });
});
