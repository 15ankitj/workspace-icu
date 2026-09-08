import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { encodeSuggestionAttr } from "@/lib/suggestion-markup";
import { fragmentToBlocks, ydocToBlocks } from "@/lib/ydoc-blocks";

/**
 * Builds documents in the exact shape y-prosemirror gives a BlockNote
 * document: elements named after nodes, node attrs as attributes, text as
 * XmlText with marks as delta attributes.
 */
function element(
  name: string,
  attrs: Record<string, unknown>,
  children: (Y.XmlElement | Y.XmlText)[] = [],
) {
  const el = new Y.XmlElement(name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v as string);
  el.insert(0, children);
  return el;
}

function text(
  deltas: { insert: string; attributes?: Record<string, unknown> }[],
) {
  const t = new Y.XmlText();
  t.applyDelta(deltas);
  return t;
}

function block(
  id: string,
  type: string,
  props: Record<string, unknown>,
  content: (Y.XmlElement | Y.XmlText)[],
  extra: {
    children?: Y.XmlElement[];
    containerAttrs?: Record<string, unknown>;
  } = {},
) {
  const inner = [element(type, props, content)];
  if (extra.children?.length)
    inner.push(element("blockGroup", {}, extra.children));
  return element(
    "blockContainer",
    { id, ...(extra.containerAttrs ?? {}) },
    inner,
  );
}

function docWith(blocks: Y.XmlElement[]) {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("document");
  fragment.insert(0, [element("blockGroup", {}, blocks)]);
  return { doc, fragment };
}

describe("ydocToBlocks", () => {
  it("reproduces BlockNote's block JSON for text, links, mentions and nesting", () => {
    const { fragment } = docWith([
      block(
        "p1",
        "heading",
        { level: 2, textAlignment: "left" },
        [text([{ insert: "Title" }])],
        {
          children: [
            block("p2", "bulletListItem", {}, [
              text([
                { insert: "plain " },
                { insert: "bold", attributes: { bold: {} } },
                { insert: " then ", attributes: {} },
                {
                  insert: "a link",
                  attributes: { link: { href: "https://example.org" } },
                },
                {
                  insert: " more",
                  attributes: {
                    link: { href: "https://example.org" },
                    italic: {},
                  },
                },
                { insert: " end" },
              ]),
              element("userMention", { userId: "u1", name: "Sam" }),
              text([{ insert: "!" }]),
            ]),
          ],
        },
      ),
      block("p3", "divider", {}, []),
      block("p4", "pageLink", { pageId: "x", title: "Other", icon: "" }, []),
    ]);
    const blocks = fragmentToBlocks(fragment);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      id: "p1",
      type: "heading",
      props: { level: 2, textAlignment: "left" },
      content: [{ type: "text", text: "Title", styles: {} }],
    });
    const item = blocks[0].children?.[0];
    expect(item?.type).toBe("bulletListItem");
    expect(item?.content).toEqual([
      { type: "text", text: "plain ", styles: {} },
      { type: "text", text: "bold", styles: { bold: true } },
      { type: "text", text: " then ", styles: {} },
      {
        type: "link",
        href: "https://example.org",
        content: [
          { type: "text", text: "a link", styles: {} },
          { type: "text", text: " more", styles: { italic: true } },
        ],
      },
      { type: "text", text: " end", styles: {} },
      {
        type: "userMention",
        props: { userId: "u1", name: "Sam" },
        content: undefined,
      },
      { type: "text", text: "!", styles: {} },
    ]);
    expect(blocks[1]).toMatchObject({
      type: "divider",
      props: {},
      children: [],
    });
    expect(blocks[1].content).toBeUndefined();
    expect(blocks[2]).toMatchObject({
      type: "pageLink",
      props: { pageId: "x", title: "Other" },
    });
  });

  it("reads tables and code blocks", () => {
    const { fragment } = docWith([
      block("t", "table", { textColor: "default" }, [
        element("tableRow", {}, [
          element("tableCell", { colspan: 1, rowspan: 1, colwidth: [120] }, [
            element("tableParagraph", {}, [text([{ insert: "A" }])]),
          ]),
          element("tableCell", { colspan: 1, rowspan: 1 }, [
            element("tableParagraph", {}, [text([{ insert: "B" }])]),
            element("tableParagraph", {}, [text([{ insert: "C" }])]),
          ]),
        ]),
      ]),
      block("c", "codeBlock", { language: "sql" }, [
        text([{ insert: "select 1;" }]),
      ]),
    ]);
    const [table, code] = fragmentToBlocks(fragment);
    expect(table.content).toMatchObject({
      type: "tableContent",
      columnWidths: [120, null],
      rows: [
        {
          cells: [
            {
              type: "tableCell",
              content: [{ type: "text", text: "A", styles: {} }],
            },
            {
              type: "tableCell",
              content: [{ type: "text", text: "B\nC", styles: {} }],
            },
          ],
        },
      ],
    });
    expect(code.content).toEqual([
      { type: "text", text: "select 1;", styles: {} },
    ]);
  });

  it("keeps inline and block-level suggestion markup", () => {
    const attr = encodeSuggestionAttr([
      { type: "insertion", attrs: { id: "dece6abe:blk00001" } },
    ]);
    const { fragment } = docWith([
      block("p1", "paragraph", { textAlignment: "left" }, [
        text([
          { insert: "keep " },
          {
            insert: "old",
            attributes: { deletion: { id: "dece6abe:sug00001" } },
          },
          {
            insert: "new",
            attributes: { insertion: { id: "dece6abe:sug00001" }, bold: {} },
          },
          {
            insert: "​",
            attributes: { "insertion--abcdefgh": { id: "dece6abe:sug00002" } },
          },
        ]),
      ]),
      block("p2", "paragraph", {}, [text([{ insert: "whole block" }])], {
        containerAttrs: { suggestion: attr },
      }),
    ]);
    const [p1, p2] = fragmentToBlocks(fragment);
    expect(p1.content).toEqual([
      { type: "text", text: "keep ", styles: {} },
      {
        type: "text",
        text: "old",
        styles: { suggestion: "deletion", suggestionId: "dece6abe:sug00001" },
      },
      {
        type: "text",
        text: "new",
        styles: {
          bold: true,
          suggestion: "insertion",
          suggestionId: "dece6abe:sug00001",
        },
      },
      {
        type: "text",
        text: "​",
        styles: { suggestion: "insertion", suggestionId: "dece6abe:sug00002" },
      },
    ]);
    expect(p1.suggestion).toBeUndefined();
    expect(p1.props).toEqual({ textAlignment: "left" });
    expect(p2.suggestion).toEqual({
      kind: "insertion",
      id: "dece6abe:blk00001",
    });
    expect(p2.props).toEqual({});
  });

  it("decodes an encoded update", () => {
    const { doc } = docWith([
      block("p1", "paragraph", {}, [text([{ insert: "hi" }])]),
    ]);
    const bytes = Y.encodeStateAsUpdate(doc);
    expect(ydocToBlocks(bytes)).toEqual([
      {
        id: "p1",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "hi", styles: {} }],
        children: [],
      },
    ]);
    expect(ydocToBlocks(bytes, "other")).toEqual([]);
  });
});
