"use client";

import {
  BLOCK_LEVEL_SUGGESTION_GROUP,
  NON_FORMATTING_MARK_GROUP,
  createExtension,
  docToBlocks,
  type BlockNoteEditor,
} from "@blocknote/core";
import { Mark } from "@tiptap/core";
import {
  applySuggestion,
  applySuggestions,
  disableSuggestChanges,
  enableSuggestChanges,
  isSuggestChangesEnabled,
  revertSuggestion,
  revertSuggestions,
  suggestChanges,
  withSuggestChanges,
} from "@handlewithcare/prosemirror-suggest-changes";
import type { MarkSpec, Node as PMNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { EditorBlock } from "@/lib/blocks";
import { makeSuggestionId, type SuggestionKind } from "@/lib/suggestions";

/**
 * Suggestion mode in the editor (Appendix A, Part 2). Suggestions are the
 * `insertion` / `deletion` / `modification` marks of
 * @handlewithcare/prosemirror-suggest-changes, living inside the page's
 * ProseMirror document and therefore inside its Yjs document: history,
 * presence and offline behaviour come for free. The marks are declared
 * with tiptap's Mark API (the way BlockNote's own AI package does) so
 * BlockNote's schema admits them on inline content and on whole blocks;
 * they are `blocknoteIgnore`d by BlockNote's content model, which is why
 * the saved projection is produced by {@link cleanDocument} instead.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

const GROUP = `${BLOCK_LEVEL_SUGGESTION_GROUP} ${NON_FORMATTING_MARK_GROUP}`;

function idAttr() {
  return { id: { default: null } };
}

function parseId(node: HTMLElement) {
  const id = node.dataset["id"];
  return id ? { id } : false;
}

const InsertionMark = Mark.create({
  name: "insertion",
  inclusive: false,
  excludes: "deletion modification insertion",
  group: GROUP,
  addAttributes: idAttr,
  extendMarkSchema(extension) {
    if (extension.name !== "insertion") return {};
    return {
      blocknoteIgnore: true,
      inclusive: false,
      toDOM(mark, inline) {
        return [
          "ins",
          {
            "data-id": String(mark.attrs["id"]),
            "data-inline": String(inline),
            class: "wi-suggest wi-suggest-ins",
            ...(!inline && { style: "display: contents" }),
          },
          0,
        ];
      },
      parseDOM: [
        { tag: "ins[data-id]", getAttrs: (n) => parseId(n as HTMLElement) },
      ],
    } satisfies MarkSpec;
  },
});

const DeletionMark = Mark.create({
  name: "deletion",
  inclusive: false,
  excludes: "insertion modification deletion",
  group: GROUP,
  addAttributes: idAttr,
  extendMarkSchema(extension) {
    if (extension.name !== "deletion") return {};
    return {
      blocknoteIgnore: true,
      inclusive: false,
      toDOM(mark, inline) {
        return [
          "del",
          {
            "data-id": String(mark.attrs["id"]),
            "data-inline": String(inline),
            class: "wi-suggest wi-suggest-del",
            ...(!inline && { style: "display: contents" }),
          },
          0,
        ];
      },
      parseDOM: [
        { tag: "del[data-id]", getAttrs: (n) => parseId(n as HTMLElement) },
      ],
    } satisfies MarkSpec;
  },
});

const ModificationMark = Mark.create({
  name: "modification",
  inclusive: false,
  excludes: "deletion insertion",
  group: GROUP,
  addAttributes() {
    return {
      id: { default: null },
      type: { default: null },
      attrName: { default: null },
      previousValue: { default: null },
      newValue: { default: null },
    };
  },
  extendMarkSchema(extension) {
    if (extension.name !== "modification") return {};
    return {
      blocknoteIgnore: true,
      inclusive: false,
      toDOM(mark, inline) {
        return [
          inline ? "span" : "div",
          {
            "data-type": "modification",
            "data-id": String(mark.attrs["id"]),
            "data-mod-type": String(mark.attrs["type"] ?? ""),
            class: "wi-suggest wi-suggest-mod",
            ...(!inline && { style: "display: contents" }),
          },
          0,
        ];
      },
      parseDOM: [
        {
          tag: "[data-type='modification']",
          getAttrs: (n) => parseId(n as HTMLElement),
        },
      ],
    } satisfies MarkSpec;
  },
});

/** The plugin that owns the on/off state. Its decorations are not used:
 *  the marks render themselves and the app draws its own affordances. */
function suggestPlugin() {
  const plugin = suggestChanges();
  plugin.props.decorations = undefined;
  return plugin;
}

/** Register on every editor that may hold or display suggestions. */
export const SuggestionsExtension = createExtension(() => ({
  key: "suggestions",
  tiptapExtensions: [InsertionMark, DeletionMark, ModificationMark],
  prosemirrorPlugins: [suggestPlugin()],
}));

/**
 * Route the view's transactions through the library while Suggest mode is
 * on, minting ids that carry the suggester. Remote (Yjs) and undo/redo
 * transactions pass through untouched. Returns the uninstaller.
 */
export function installSuggestDispatch(editor: AnyEditor, userId: string) {
  const view = editor.prosemirrorView;
  const original = view.props.dispatchTransaction;
  const wrapped = withSuggestChanges(
    function (this: EditorView, tr) {
      if (original) original.call(this, tr);
      else this.updateState(this.state.apply(tr));
    },
    () => makeSuggestionId(userId),
  );
  view.setProps({ dispatchTransaction: wrapped });
  return () => {
    // On navigation BlockNote may have destroyed the view before this
    // cleanup runs; restoring props on a dead view throws, and a throw
    // here surfaces as the route's error boundary.
    if (view.isDestroyed) return;
    try {
      view.setProps({ dispatchTransaction: original });
    } catch {
      // Nothing to restore.
    }
  };
}

export function setSuggesting(editor: AnyEditor, on: boolean) {
  const view = editor.prosemirrorView;
  if (view.isDestroyed) return;
  if (isSuggestChangesEnabled(view.state) === on) return;
  (on ? enableSuggestChanges : disableSuggestChanges)(
    view.state,
    view.dispatch,
  );
}

export function isSuggesting(editor: AnyEditor): boolean {
  return isSuggestChangesEnabled(editor.prosemirrorState);
}

/** The document with every open suggestion reverted: what the page says
 *  until the author accepts (brief §2.4). This is what gets saved. */
export function cleanDocument(editor: AnyEditor): EditorBlock[] {
  const state = editor.prosemirrorState;
  let scratch = EditorState.create({ doc: state.doc, schema: state.schema });
  revertSuggestions(scratch, (tr) => {
    scratch = scratch.apply(tr);
  });
  return docToBlocks(scratch.doc) as unknown as EditorBlock[];
}

export interface SuggestionSpan {
  id: string;
  kind: SuggestionKind;
  from: number;
  to: number;
  /** Inserted or deleted text, for the excerpt. */
  text: string;
}

/** Every suggestion in the document, first occurrence first. */
export function listSuggestions(doc: PMNode): SuggestionSpan[] {
  const byId = new Map<string, SuggestionSpan>();
  const note = (
    id: unknown,
    kind: SuggestionKind,
    from: number,
    to: number,
    text: string,
  ) => {
    if (id === null || id === undefined) return;
    const key = String(id);
    const existing = byId.get(key);
    if (existing) {
      existing.from = Math.min(existing.from, from);
      existing.to = Math.max(existing.to, to);
      if (kind === "insertion" && existing.kind !== "insertion") {
        existing.kind = "insertion";
      }
      if (text) existing.text += text;
      return;
    }
    byId.set(key, { id: key, kind, from, to, text });
  };
  doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      const kind = mark.type.name as SuggestionKind;
      if (
        kind !== "insertion" &&
        kind !== "deletion" &&
        kind !== "modification"
      ) {
        continue;
      }
      note(
        mark.attrs["id"],
        kind,
        pos,
        pos + node.nodeSize,
        node.isText ? (node.text ?? "") : "",
      );
    }
    return true;
  });
  return [...byId.values()];
}

/** The suggestion under the selection, if any. */
export function suggestionAtSelection(
  editor: AnyEditor,
  spans: SuggestionSpan[],
): SuggestionSpan | null {
  const { from, to } = editor.prosemirrorState.selection;
  return (
    spans.find((s) => from >= s.from && to <= s.to) ??
    spans.find((s) => from < s.to && to > s.from) ??
    null
  );
}

/** Screen position of a document position, relative to the viewport. */
export function coordsOf(editor: AnyEditor, pos: number) {
  try {
    return editor.prosemirrorView.coordsAtPos(pos);
  } catch {
    return null;
  }
}

/** Apply (accept) or revert (reject/withdraw) one suggestion in the live
 *  document. Runs with suggesting off so the change is not itself
 *  recorded as a suggestion. */
export function resolveInDocument(
  editor: AnyEditor,
  id: string,
  outcome: "accept" | "revert",
) {
  const view = editor.prosemirrorView;
  const wasSuggesting = isSuggestChangesEnabled(view.state);
  if (wasSuggesting) disableSuggestChanges(view.state, view.dispatch);
  const command =
    outcome === "accept" ? applySuggestion(id) : revertSuggestion(id);
  const ok = command(view.state, view.dispatch);
  if (wasSuggesting) enableSuggestChanges(view.state, view.dispatch);
  return ok;
}

export function resolveAllInDocument(
  editor: AnyEditor,
  outcome: "accept" | "revert",
) {
  const view = editor.prosemirrorView;
  const wasSuggesting = isSuggestChangesEnabled(view.state);
  if (wasSuggesting) disableSuggestChanges(view.state, view.dispatch);
  const ok = (outcome === "accept" ? applySuggestions : revertSuggestions)(
    view.state,
    view.dispatch,
  );
  if (wasSuggesting) enableSuggestChanges(view.state, view.dispatch);
  return ok;
}
