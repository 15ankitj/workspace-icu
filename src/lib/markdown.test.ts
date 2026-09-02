import { describe, expect, it } from "vitest";
import {
  blocksToMarkdown,
  fileIdsIn,
  type MarkdownContext,
} from "@/lib/markdown";
import type { EditorBlock } from "@/lib/blocks";

const ctx: MarkdownContext = {
  pageTitle: (id) => (id === "p2" ? "Second page" : null),
  pageHref: (id) => `./${id}.md`,
  fileHref: (id) => `files/${id}.png`,
};

const text = (t: string, styles: Record<string, unknown> = {}) => ({
  type: "text",
  text: t,
  styles,
});

describe("blocksToMarkdown", () => {
  it("renders headings, styled text, links and mentions", () => {
    const doc: EditorBlock[] = [
      {
        id: "1",
        type: "heading",
        props: { level: 2 },
        content: [text("Plan")],
      },
      {
        id: "2",
        type: "paragraph",
        content: [
          text("Read "),
          text("this", { bold: true }),
          text(" and "),
          { type: "link", href: "https://ficm.ac.uk", content: [text("FICM")] },
          text(" with "),
          { type: "userMention", props: { name: "Sam" } },
          text(" on "),
          { type: "pageMention", props: { pageId: "p2", title: "old" } },
        ],
      },
    ];
    expect(blocksToMarkdown(doc, ctx)).toBe(
      "## Plan\n\nRead **this** and [FICM](https://ficm.ac.uk) with @Sam on [Second page](./p2.md)\n",
    );
  });

  it("renders nested lists, to-dos, quotes, code and dividers", () => {
    const doc: EditorBlock[] = [
      {
        id: "1",
        type: "bulletListItem",
        content: [text("Parent")],
        children: [
          { id: "2", type: "numberedListItem", content: [text("First")] },
          { id: "3", type: "numberedListItem", content: [text("Second")] },
        ],
      },
      {
        id: "4",
        type: "checkListItem",
        props: { checked: true },
        content: [text("Done")],
      },
      { id: "5", type: "quote", content: [text("Wise words")] },
      { id: "6", type: "divider" },
      {
        id: "7",
        type: "codeBlock",
        props: { language: "sql" },
        content: [text("select 1;")],
      },
    ];
    expect(blocksToMarkdown(doc, ctx)).toBe(
      [
        "- Parent",
        "  1. First",
        "  2. Second",
        "- [x] Done",
        "",
        "> Wise words",
        "",
        "---",
        "",
        "```sql\nselect 1;\n```",
        "",
      ].join("\n"),
    );
  });

  it("renders tables, images, files, callouts and page links", () => {
    const doc: EditorBlock[] = [
      {
        id: "1",
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: [[text("KC")], [text("Status")]] },
            { cells: [[text("1.1")], [text("Met | ok")]] },
          ],
        },
      },
      {
        id: "2",
        type: "image",
        props: { url: "/api/files/f1", caption: "Scan" },
      },
      {
        id: "3",
        type: "file",
        props: { url: "/api/files/f2", name: "notes.pdf" },
      },
      {
        id: "4",
        type: "callout",
        props: { emoji: "⚠️" },
        content: [text("Careful")],
      },
      { id: "5", type: "pageLink", props: { pageId: "p2", title: "x" } },
      { id: "6", type: "tableOfContents" },
    ];
    expect(blocksToMarkdown(doc, ctx)).toBe(
      [
        "| KC | Status |",
        "| --- | --- |",
        "| 1.1 | Met \\| ok |",
        "",
        "![Scan](files/f1.png)",
        "*Scan*",
        "",
        "[notes.pdf](files/f2.png)",
        "",
        "> ⚠️ Careful",
        "",
        "[Second page](./p2.md)",
        "",
      ].join("\n"),
    );
    expect(fileIdsIn(doc).sort()).toEqual(["f1", "f2"]);
  });

  it("escapes Markdown control characters in text", () => {
    const doc: EditorBlock[] = [
      { id: "1", type: "paragraph", content: [text("a*b_c [d] #e")] },
    ];
    expect(blocksToMarkdown(doc, ctx)).toBe("a\\*b\\_c \\[d\\] \\#e\n");
  });
});
