import { describe, expect, it } from "vitest";
import {
  containsSyncedBlock,
  locallyRemovedPlacementIds,
  parsePurgeDecisions,
  parseSyncedClipboardText,
  PURGE_DELETE,
  placementProps,
  roomIdForSyncedBlock,
  syncedBlockIdFromRoomId,
  syncedBlockIdsIn,
  syncedClipboardText,
  titleFromBlocks,
} from "@/lib/synced";
import type { EditorBlock } from "@/lib/blocks";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const placement = (id: string, readOnly = false): EditorBlock => ({
  id: `p-${id}-${readOnly}`,
  type: "syncedBlock",
  props: { syncedBlockId: id, readOnly },
});

describe("synced room ids", () => {
  it("round-trips and rejects other rooms", () => {
    expect(syncedBlockIdFromRoomId(roomIdForSyncedBlock(A))).toBe(A);
    expect(syncedBlockIdFromRoomId(`page:${A}`)).toBeNull();
    expect(syncedBlockIdFromRoomId("synced:not-a-uuid")).toBeNull();
    expect(syncedBlockIdFromRoomId(`synced:${A.toUpperCase()}`)).toBe(A);
  });
});

describe("clipboard token", () => {
  it("round-trips and tolerates whitespace", () => {
    expect(parseSyncedClipboardText(` ${syncedClipboardText(A)}\n`)).toBe(A);
    expect(parseSyncedClipboardText("hello")).toBeNull();
    expect(parseSyncedClipboardText("workspaceicu:synced:nope")).toBeNull();
  });
});

describe("placements in a document", () => {
  it("lists distinct ids in document order, nested included", () => {
    const doc: EditorBlock[] = [
      { id: "1", type: "paragraph", content: [] },
      placement(B, true),
      {
        id: "2",
        type: "bulletListItem",
        content: [],
        children: [placement(A), placement(B)],
      },
    ];
    expect(syncedBlockIdsIn(doc)).toEqual([B, A]);
    expect(placementProps(placement(A, true))).toEqual({
      syncedBlockId: A,
      readOnly: true,
    });
    expect(
      placementProps({
        id: "x",
        type: "syncedBlock",
        props: { syncedBlockId: "bad" },
      }),
    ).toBeNull();
  });

  it("detects nested synced blocks", () => {
    expect(containsSyncedBlock({ id: "p", type: "paragraph" })).toBe(false);
    expect(
      containsSyncedBlock({
        id: "t",
        type: "toggleListItem",
        children: [{ id: "u", type: "paragraph", children: [placement(A)] }],
      }),
    ).toBe(true);
  });
});

describe("titleFromBlocks", () => {
  it("takes the first text, including table cells, and truncates", () => {
    expect(
      titleFromBlocks([
        {
          id: "h",
          type: "heading",
          content: [{ type: "text", text: "HiLLO 3" }],
        },
        {
          id: "p",
          type: "paragraph",
          content: [{ type: "text", text: "Progress" }],
        },
      ]),
    ).toBe("HiLLO 3 Progress");
    expect(
      titleFromBlocks([
        {
          id: "t",
          type: "table",
          content: {
            type: "tableContent",
            rows: [{ cells: [[{ type: "text", text: "Capability" }]] }],
          },
        },
      ]),
    ).toBe("Capability");
    expect(titleFromBlocks([{ id: "d", type: "divider" }])).toBe(
      "Synced block",
    );
    expect(
      titleFromBlocks(
        [
          {
            id: "p",
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(200) }],
          },
        ],
        20,
      ),
    ).toHaveLength(20);
  });
});

describe("locallyRemovedPlacementIds", () => {
  const change = (type: string, source: string, block: EditorBlock) => ({
    type,
    source: { type: source },
    block,
  });

  it("attributes local, undo and paste deletions, nested included", () => {
    expect(
      locallyRemovedPlacementIds([
        change("delete", "local", placement(A)),
        change("delete", "undo", {
          id: "wrap",
          type: "bulletListItem",
          children: [placement(B)],
        }),
        change("delete", "local", { id: "p", type: "paragraph" }),
        change("insert", "local", placement(A)),
        change("delete", "local", placement(A)),
      ]),
    ).toEqual([A, B]);
  });

  it("ignores remote deletions and non-deletions", () => {
    expect(
      locallyRemovedPlacementIds([
        change("delete", "yjs-remote", placement(A)),
        change("update", "local", placement(B)),
        change("move", "local", placement(B)),
      ]),
    ).toEqual([]);
  });
});

describe("parsePurgeDecisions", () => {
  it("keeps only known ids and valid targets", () => {
    const decisions = parsePurgeDecisions(
      JSON.stringify({
        [A]: B.toUpperCase(),
        [B]: "delete",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc": B,
        [`${A}x`]: "nope",
      }),
      [A, B],
    );
    expect([...decisions.entries()]).toEqual([
      [A, B],
      [B, PURGE_DELETE],
    ]);
  });

  it("treats garbage as no decisions", () => {
    expect(parsePurgeDecisions("not json", [A]).size).toBe(0);
    expect(parsePurgeDecisions("[1]", [A]).size).toBe(0);
    expect(parsePurgeDecisions(null, [A]).size).toBe(0);
    expect(parsePurgeDecisions(JSON.stringify({ [A]: 42 }), [A]).get(A)).toBe(
      PURGE_DELETE,
    );
  });
});
