import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { EditorState } from "prosemirror-state";
import { ySyncPluginKey } from "y-prosemirror";
import {
  listSuggestions,
  mirrorPlugin,
  SuggestionsExtension,
} from "@/components/editor/suggestions";
import { SUGGESTION_ATTR } from "@/lib/suggestion-markup";

/**
 * The mirror plugin on a bare ProseMirror state with BlockNote's schema:
 * local node marks become the synced attribute, and a document that
 * arrives from Yjs (attribute, no marks) gets its marks back.
 */
function schemaWithSuggestions() {
  const editor = BlockNoteEditor.create({
    _headless: true,
    extensions: [SuggestionsExtension()],
  } as unknown as Parameters<typeof BlockNoteEditor.create>[0]);
  return editor.pmSchema;
}

function stateWith(attr: string | null, withMark: boolean) {
  const schema = schemaWithSuggestions();
  const marks = withMark
    ? [schema.marks["insertion"].create({ id: "dece6abe:blk00001" })]
    : [];
  const paragraph = schema.nodes["paragraph"].create({}, schema.text("hello"));
  const container = schema.nodes["blockContainer"].create(
    { id: "b1", [SUGGESTION_ATTR]: attr },
    paragraph,
    marks,
  );
  const doc = schema.nodes["doc"].create(
    {},
    schema.nodes["blockGroup"].create({}, container),
  );
  return EditorState.create({ doc, schema, plugins: [mirrorPlugin()] });
}

const container = (state: EditorState) => state.doc.firstChild!.firstChild!;

describe("suggestion mirror plugin", () => {
  it("writes local node marks into the synced attribute", () => {
    let state = stateWith(null, true);
    // Any local document change triggers reconciliation.
    state = state.apply(state.tr.insertText("!", 3));
    const attr = container(state).attrs[SUGGESTION_ATTR];
    expect(attr).toBeTypeOf("string");
    expect(JSON.parse(attr)).toEqual([
      { type: "insertion", attrs: { id: "dece6abe:blk00001" } },
    ]);
  });

  it("restores node marks from the attribute on a Yjs-origin transaction", () => {
    const attr = JSON.stringify([
      { type: "insertion", attrs: { id: "dece6abe:blk00001" } },
    ]);
    let state = stateWith(attr, false);
    expect(container(state).marks).toHaveLength(0);
    // The bar already counts it through the attribute.
    expect(listSuggestions(state.doc).map((s) => s.id)).toEqual([
      "dece6abe:blk00001",
    ]);
    state = state.apply(
      state.tr.setMeta(ySyncPluginKey, { isChangeOrigin: true }),
    );
    const marks = container(state).marks;
    expect(marks.map((m) => [m.type.name, m.attrs["id"]])).toEqual([
      ["insertion", "dece6abe:blk00001"],
    ]);
    expect(listSuggestions(state.doc)).toHaveLength(1);
  });

  it("clears the attribute when the marks go and stays quiet otherwise", () => {
    const attr = JSON.stringify([
      { type: "insertion", attrs: { id: "dece6abe:blk00001" } },
    ]);
    let state = stateWith(attr, false);
    state = state.apply(
      state.tr.setMeta(ySyncPluginKey, { isChangeOrigin: true }),
    );
    // A selection-only transaction appends nothing.
    const before = state.doc;
    state = state.apply(state.tr);
    expect(state.doc).toBe(before);
    // Accepting locally removes the mark; the attribute follows.
    const node = container(state);
    state = state.apply(state.tr.setNodeMarkup(1, null, node.attrs, []));
    expect(container(state).attrs[SUGGESTION_ATTR]).toBeNull();
  });
});
