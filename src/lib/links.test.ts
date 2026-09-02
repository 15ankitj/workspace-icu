import { describe, expect, it } from "vitest";
import { extractPageLinks } from "@/lib/links";
import type { EditorBlock } from "@/lib/blocks";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";

describe("extractPageLinks", () => {
  it("finds page-link blocks and inline page mentions, deduplicated", () => {
    const doc: EditorBlock[] = [
      { id: "1", type: "pageLink", props: { pageId: a, title: "A" } },
      {
        id: "2",
        type: "paragraph",
        content: [
          { type: "text", text: "see ", styles: {} },
          { type: "pageMention", props: { pageId: b, title: "B" } },
          { type: "pageMention", props: { pageId: a, title: "A" } },
        ],
      },
    ];
    expect(extractPageLinks(doc).sort()).toEqual([a, b].sort());
  });

  it("looks inside nested children and table cells", () => {
    const doc: EditorBlock[] = [
      {
        id: "1",
        type: "bulletListItem",
        content: [],
        children: [
          {
            id: "2",
            type: "paragraph",
            content: [{ type: "pageMention", props: { pageId: c } }],
          },
        ],
      },
      {
        id: "3",
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: [[{ type: "pageMention", props: { pageId: b } }]] }],
        },
      },
    ];
    expect(extractPageLinks(doc).sort()).toEqual([b, c].sort());
  });

  it("ignores malformed ids and unrelated blocks", () => {
    const doc: EditorBlock[] = [
      { id: "1", type: "pageLink", props: { pageId: "" } },
      { id: "2", type: "pageLink", props: { pageId: "nope" } },
      { id: "3", type: "heading", content: [{ type: "text", text: "Hi" }] },
    ];
    expect(extractPageLinks(doc)).toEqual([]);
  });
});
