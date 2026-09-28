// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { BlockNoteEditor } from "@blocknote/core";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { editorSchema } from "@/components/editor/schema";
import {
  seedFromStoredBlocks,
  withDefaultProps,
} from "@/components/editor/seed";
import {
  installSuggestDispatch,
  SuggestionsExtension,
} from "@/components/editor/suggestions";
import { buildDocument, flattenDocument, type EditorBlock } from "@/lib/blocks";

/**
 * Runs a real BlockNote editor, bound to a Yjs fragment as page-editor.tsx
 * binds it (collaboration plus the suggestions extension), in jsdom.
 * ProseMirror measures the DOM on mount; jsdom has no layout, so the
 * measuring calls are stubbed.
 */
const zero = () => ({
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON() {},
});
const noRects = () => ({
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
});
Range.prototype.getBoundingClientRect = zero as never;
Range.prototype.getClientRects = noRects as never;
HTMLElement.prototype.getBoundingClientRect = zero as never;
HTMLElement.prototype.getClientRects = noRects as never;
HTMLElement.prototype.scrollIntoView = () => {};
(globalThis as Record<string, unknown>).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const text = (t: string) => [{ type: "text", text: t, styles: {} }];

/** Rows as a pack template writes them: only the props the author set. */
const TEMPLATE_BLOCKS: EditorBlock[] = [
  { id: "b1", type: "heading", props: {}, content: text("What it is") },
  { id: "b2", type: "paragraph", props: {}, content: text("A description.") },
  {
    id: "b3",
    type: "checkListItem",
    props: { checked: false },
    content: text("Names removed"),
    children: [
      { id: "b4", type: "paragraph", props: {}, content: text("nested") },
    ],
  },
  {
    id: "b5",
    type: "callout",
    props: { emoji: "💡", colour: "blue" },
    content: text("How to"),
  },
  { id: "b6", type: "divider", props: {} },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;
const mounted: { editor: AnyEditor; root: HTMLElement }[] = [];
afterEach(() => {
  for (const { editor, root } of mounted.splice(0)) {
    try {
      editor.mount(null as unknown as HTMLElement);
    } catch {
      // already torn down
    }
    root.remove();
  }
});

/** An editor bound to `fragment` exactly as the page editor binds it. */
async function mountEditor(fragment: Y.XmlFragment, doc: Y.Doc) {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    extensions: [
      SuggestionsExtension(),
      CollaborationExtension({
        fragment,
        user: { name: "Test", color: "#ff0000" },
        provider: { awareness: new Awareness(doc) } as never,
        showCursorLabels: "activity",
      }),
    ],
  } as never) as unknown as AnyEditor;
  const root = document.createElement("div");
  document.body.appendChild(root);
  editor.mount(root);
  // The page editor routes every editable view's transactions through the
  // suggestion library (page-editor.tsx); it is part of what makes the
  // initial document differ from BlockNote's expected one.
  installSuggestDispatch(editor, "user-1");
  mounted.push({ editor, root });
  // Let the plugins' first pass (and y-prosemirror's initial write) run.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return editor;
}

const blockGroup = (fragment: Y.XmlFragment) =>
  fragment.length ? (fragment.get(0) as Y.XmlElement) : null;

describe("withDefaultProps", () => {
  const schema = editorSchema.blockSchema;

  it("fills every missing prop from the schema's defaults and keeps the ones set", () => {
    const [heading, paragraph, todo, callout, divider] = withDefaultProps(
      TEMPLATE_BLOCKS,
      schema,
    );
    expect(heading.props).toMatchObject({
      level: 1,
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
    });
    expect(paragraph.props).toEqual(
      expect.objectContaining({
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      }),
    );
    expect(todo.props).toMatchObject({ checked: false, textColor: "default" });
    expect(todo.children?.[0].props).toMatchObject({ textColor: "default" });
    expect(callout.props).toEqual({ emoji: "💡", colour: "blue" });
    expect(divider.props).toEqual({});
  });

  it("keeps set props over defaults and leaves unknown types alone", () => {
    const [heading] = withDefaultProps(
      [{ id: "h", type: "heading", props: { level: 3 }, content: text("x") }],
      schema,
    );
    expect(heading.props?.level).toBe(3);
    const [unknown] = withDefaultProps(
      [{ id: "u", type: "notABlock", props: { a: 1 } }],
      schema,
    );
    expect(unknown).toEqual({ id: "u", type: "notABlock", props: { a: 1 } });
  });
});

describe("seedFromStoredBlocks", () => {
  it("the trap: after mount the fragment is no longer empty, so an emptiness check never seeds", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    expect(fragment.length).toBe(0);
    await mountEditor(fragment, doc);
    // y-prosemirror wrote the editor's initial empty paragraph.
    expect(fragment.length).toBe(1);
    expect(blockGroup(fragment)?.length).toBe(1);
  });

  it("seeds a blank synced document from template rows with props: {}", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    const editor = await mountEditor(fragment, doc);

    expect(seedFromStoredBlocks(editor, fragment, TEMPLATE_BLOCKS)).toBe(
      "seeded",
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(editor.document.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "checkListItem",
      "callout",
      "divider",
    ]);
    // The heading landed with the full default prop set, as if typed.
    expect(editor.document[0].props).toMatchObject({
      level: 1,
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
    });
    expect(editor.document[2].children).toHaveLength(1);
    // And it is in Yjs, which is what the room (and the save) carries.
    expect(blockGroup(fragment)?.length).toBe(5);
    const first = blockGroup(fragment)!.get(0) as Y.XmlElement;
    expect((first.get(0) as Y.XmlElement).nodeName).toBe("heading");
    expect((first.get(0) as Y.XmlElement).toString()).toContain("What it is");
  });

  it("seeds a pack page's full row set as the database returns it", async () => {
    // Rows go through the same round trip as the page route: flatten to
    // rows, rebuild the document.
    const { CESR_CURRICULUM } =
      await import("../../../content/cesr-curriculum");
    const { kcPage } = await import("../../../content/cesr-hillo-pages");
    const page = kcPage(CESR_CURRICULUM[11], CESR_CURRICULUM[11].kcs[3], {
      page: "kc",
      hilloPage: "hillo",
    });
    const stored = buildDocument(
      flattenDocument(page.blocks.flat()).map((row) => ({ ...row })),
    );
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    const editor = await mountEditor(fragment, doc);
    expect(seedFromStoredBlocks(editor, fragment, stored)).toBe("seeded");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(editor.document).toHaveLength(stored.length);
    expect(blockGroup(fragment)?.length).toBe(stored.length);
    const types = editor.document.map((b) => b.type);
    expect(types[0]).toBe("callout");
    expect(types.at(-1)).toBe("pageLink");
  });

  it("heals a document a previous open left as one empty paragraph", async () => {
    // The room already holds what the buggy path wrote: a block group with
    // one empty paragraph, as if from Liveblocks storage.
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    const group = new Y.XmlElement("blockGroup");
    const container = new Y.XmlElement("blockContainer");
    container.setAttribute("id", "stale");
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.setAttribute("textAlignment", "left");
    container.insert(0, [paragraph]);
    group.insert(0, [container]);
    fragment.insert(0, [group]);

    const editor = await mountEditor(fragment, doc);
    expect(editor.document).toHaveLength(1);
    expect(seedFromStoredBlocks(editor, fragment, TEMPLATE_BLOCKS)).toBe(
      "seeded",
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(editor.document.map((b) => b.type)[0]).toBe("heading");
    expect(blockGroup(fragment)?.length).toBe(5);
  });

  it("leaves a document that already says something alone", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    const editor = await mountEditor(fragment, doc);
    editor.replaceBlocks(editor.document, [
      { type: "paragraph", content: "Typed by a person" },
    ] as never);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seedFromStoredBlocks(editor, fragment, TEMPLATE_BLOCKS)).toBe(
      "kept",
    );
    expect(editor.document).toHaveLength(1);
    expect(JSON.stringify(editor.document[0].content)).toContain(
      "Typed by a person",
    );
  });

  it("does nothing when the stored rows are blank too", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    const editor = await mountEditor(fragment, doc);
    expect(seedFromStoredBlocks(editor, fragment, [])).toBe("nothing-to-seed");
    expect(
      seedFromStoredBlocks(editor, fragment, [
        { id: "e", type: "paragraph", props: {}, content: [] },
      ]),
    ).toBe("nothing-to-seed");
    expect(editor.document).toHaveLength(1);
  });

  it("surfaces BlockNote's error for a block type the schema lacks", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document");
    const editor = await mountEditor(fragment, doc);
    expect(() =>
      seedFromStoredBlocks(editor, fragment, [
        { id: "x", type: "notABlock", props: {}, content: text("x") },
      ]),
    ).toThrow(/schema lacks: notABlock/);
  });
});
