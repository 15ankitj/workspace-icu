import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { suggestChanges } from "@handlewithcare/prosemirror-suggest-changes";
import { EditorState } from "prosemirror-state";
import {
  applyOutcome,
  listSuggestions,
  mirrorPlugin,
  SuggestionsExtension,
} from "@/components/editor/suggestions";

/**
 * applyOutcome on a bare ProseMirror state: the document converges to the
 * recorded status, and asking again — or asking about a suggestion that
 * is not there — changes nothing and is not an error.
 */
function schema() {
  const editor = BlockNoteEditor.create({
    _headless: true,
    extensions: [SuggestionsExtension()],
  } as unknown as Parameters<typeof BlockNoteEditor.create>[0]);
  return editor.pmSchema;
}

const ID = "dece6abe:ins00001";

/** "Hello" with a suggested insertion of " there" after it. */
function editorWith() {
  const s = schema();
  const insertion = s.marks["insertion"].create({ id: ID });
  const paragraph = s.nodes["paragraph"].create({}, [
    s.text("Hello"),
    s.text(" there", [insertion]),
  ]);
  const doc = s.nodes["doc"].create(
    {},
    s.nodes["blockGroup"].create(
      {},
      s.nodes["blockContainer"].create({ id: "b1" }, paragraph),
    ),
  );
  let state = EditorState.create({
    doc,
    schema: s,
    plugins: [suggestChanges(), mirrorPlugin()],
  });
  const view = {
    isDestroyed: false,
    get state() {
      return state;
    },
    dispatch(tr: Parameters<EditorState["apply"]>[0]) {
      state = state.apply(tr);
    },
  };
  const editor = {
    prosemirrorView: view,
    get prosemirrorState() {
      return state;
    },
  } as unknown as Parameters<typeof applyOutcome>[0];
  return { editor, text: () => state.doc.textContent };
}

describe("applyOutcome", () => {
  it("keeps the change for an accepted suggestion", () => {
    const { editor, text } = editorWith();
    expect(listSuggestions(editor.prosemirrorState.doc)).toHaveLength(1);
    expect(applyOutcome(editor, ID, "accepted")).toBe(true);
    expect(text()).toBe("Hello there");
    expect(listSuggestions(editor.prosemirrorState.doc)).toHaveLength(0);
  });

  it.each(["rejected", "withdrawn", "stale"] as const)(
    "removes the change for a %s suggestion",
    (status) => {
      const { editor, text } = editorWith();
      expect(applyOutcome(editor, ID, status)).toBe(true);
      expect(text()).toBe("Hello");
      expect(listSuggestions(editor.prosemirrorState.doc)).toHaveLength(0);
    },
  );

  it("is a quiet no-op when there is nothing to do", () => {
    const { editor, text } = editorWith();
    expect(applyOutcome(editor, ID, "open")).toBe(false);
    expect(applyOutcome(editor, "dece6abe:missing", "rejected")).toBe(false);
    expect(text()).toBe("Hello there");
    // A repeat after convergence finds no marks and changes nothing.
    expect(applyOutcome(editor, ID, "accepted")).toBe(true);
    expect(applyOutcome(editor, ID, "accepted")).toBe(false);
    expect(applyOutcome(editor, ID, "rejected")).toBe(false);
    expect(text()).toBe("Hello there");
  });
});
