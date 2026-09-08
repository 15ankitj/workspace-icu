"use client";

import {
  BLOCK_LEVEL_SUGGESTION_GROUP,
  NON_FORMATTING_MARK_GROUP,
  createExtension,
  docToBlocks,
  type BlockNoteEditor,
} from "@blocknote/core";
import { Extension, Mark } from "@tiptap/core";
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
import type {
  Mark as PMMark,
  MarkSpec,
  Node as PMNode,
} from "prosemirror-model";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { ySyncPluginKey } from "y-prosemirror";
import type { EditorBlock } from "@/lib/blocks";
import {
  decodeSuggestionAttr,
  encodeSuggestionAttr,
  isSuggestionKind,
  SUGGESTION_ATTR,
} from "@/lib/suggestion-markup";
import {
  makeSuggestionId,
  suggestionLabel,
  type SuggestionKind,
} from "@/lib/suggestions";

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

/**
 * Whole-block suggestions are node marks, and y-prosemirror syncs node
 * attributes but not node marks: left alone they would never reach a
 * collaborator or the stored document. Every block-level node therefore
 * gets a `suggestion` attribute (a JSON string, invisible in the DOM)
 * that mirrors its suggestion marks, and {@link mirrorPlugin} keeps the
 * two in step.
 */
const BLOCK_NODE_TYPES = [
  "blockContainer",
  "blockGroup",
  "columnList",
  "column",
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "codeBlock",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "tableParagraph",
  "divider",
  "image",
  "file",
  "video",
  "audio",
  "callout",
  "embed",
  "bookmark",
  "pageLink",
  "tableOfContents",
  "syncedBlock",
];

const SuggestionAttribute = Extension.create({
  name: "suggestionAttribute",
  addGlobalAttributes() {
    return [
      {
        types: BLOCK_NODE_TYPES,
        attributes: {
          [SUGGESTION_ATTR]: {
            default: null,
            rendered: false,
            keepOnSplit: false,
          },
        },
      },
    ];
  },
});

const mirrorKey = new PluginKey<{ synced: boolean }>("wi-suggestion-mirror");

function isSuggestionMark(mark: PMMark): boolean {
  return isSuggestionKind(mark.type.name);
}

function marksAttr(node: PMNode): string | null {
  return encodeSuggestionAttr(
    node.marks.filter(isSuggestionMark).map((m) => ({
      type: m.type.name as SuggestionKind,
      attrs: m.attrs,
    })),
  );
}

/**
 * Local edits: marks → attribute (the library adds and removes node marks;
 * the attribute follows, and Yjs carries it). Documents arriving from Yjs
 * — the initial render and every remote change — have attributes but no
 * marks: attribute → marks, so the library's commands, the review bar and
 * the clean projection see the block suggestion as if it were local.
 */
export function mirrorPlugin() {
  return new Plugin<{ synced: boolean }>({
    key: mirrorKey,
    state: {
      init: () => ({ synced: false }),
      apply: (tr, value) => (tr.getMeta(mirrorKey) ? { synced: true } : value),
    },
    appendTransaction(transactions, _old, state) {
      const fromYjs = transactions.some(
        (tr) =>
          (
            tr.getMeta(ySyncPluginKey) as
              { isChangeOrigin?: boolean } | undefined
          )?.isChangeOrigin,
      );
      const synced = mirrorKey.getState(state)?.synced ?? false;
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (synced && !fromYjs && !docChanged) return null;
      const tr = state.tr;
      let changed = false;
      state.doc.descendants((node, pos) => {
        if (node.isInline) return false;
        if (!(SUGGESTION_ATTR in (node.type.spec.attrs ?? {}))) return true;
        const fromMarks = marksAttr(node);
        const attr = (node.attrs[SUGGESTION_ATTR] as string | null) ?? null;
        if (fromMarks === attr) return true;
        // From Yjs the attribute is authoritative. On the first pass over
        // a document nothing has synced yet, so a node with an attribute
        // and no marks is restored while a node with fresh local marks is
        // mirrored; after that, local marks lead.
        const restore = fromYjs || (!synced && fromMarks === null);
        if (restore) {
          const restored = decodeSuggestionAttr(attr).flatMap((m) => {
            const type = state.schema.marks[m.type];
            return type ? [type.create(m.attrs)] : [];
          });
          tr.setNodeMarkup(pos, null, node.attrs, [
            ...node.marks.filter((m) => !isSuggestionMark(m)),
            ...restored,
          ]);
        } else {
          tr.setNodeAttribute(pos, SUGGESTION_ATTR, fromMarks);
        }
        changed = true;
        return true;
      });
      if (!changed && synced) return null;
      return tr.setMeta(mirrorKey, true);
    },
  });
}

/** Register on every editor that may hold or display suggestions. */
export const SuggestionsExtension = createExtension(() => ({
  key: "suggestions",
  tiptapExtensions: [
    InsertionMark,
    DeletionMark,
    ModificationMark,
    SuggestionAttribute,
  ],
  prosemirrorPlugins: [suggestPlugin(), mirrorPlugin()],
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
  /** The dominant kind (insertion wins over deletion over modification). */
  kind: SuggestionKind;
  kinds: Set<SuggestionKind>;
  /** At least one mark sits on a whole block (insert / delete / move). */
  blockLevel: boolean;
  from: number;
  to: number;
  /** Inserted or deleted text, for the excerpt. */
  text: string;
}

const ZERO_WIDTH = /\u200b/g;

/** Every suggestion in the document, first occurrence first. Block-level
 *  marks (a whole block inserted, deleted or moved) count too. */
export function listSuggestions(doc: PMNode): SuggestionSpan[] {
  const byId = new Map<string, SuggestionSpan>();
  const note = (
    id: unknown,
    kind: SuggestionKind,
    node: PMNode,
    pos: number,
  ) => {
    if (id === null || id === undefined) return;
    const key = String(id);
    const blockLevel = !node.isInline;
    const raw = node.isText
      ? (node.text ?? "")
      : blockLevel
        ? node.textContent
        : "";
    const text = raw.replace(ZERO_WIDTH, "");
    const existing = byId.get(key);
    if (existing) {
      existing.from = Math.min(existing.from, pos);
      existing.to = Math.max(existing.to, pos + node.nodeSize);
      existing.kinds.add(kind);
      existing.blockLevel = existing.blockLevel || blockLevel;
      if (kind === "insertion" && existing.kind !== "insertion") {
        existing.kind = "insertion";
      }
      // A block-level mark already carries its whole text.
      if (text && !(blockLevel && existing.text.includes(text))) {
        existing.text += existing.text ? " " + text : text;
      }
      return;
    }
    byId.set(key, {
      id: key,
      kind,
      kinds: new Set([kind]),
      blockLevel,
      from: pos,
      to: pos + node.nodeSize,
      text,
    });
  };
  doc.descendants((node, pos) => {
    const seen = new Set<string>();
    for (const mark of node.marks) {
      const kind = mark.type.name;
      if (!isSuggestionKind(kind)) continue;
      seen.add(`${kind}:${String(mark.attrs["id"])}`);
      note(mark.attrs["id"], kind, node, pos);
    }
    // A block straight from Yjs carries its suggestion in the mirrored
    // attribute until the marks are restored; count it either way.
    if (!node.isInline && SUGGESTION_ATTR in (node.type.spec.attrs ?? {})) {
      for (const m of decodeSuggestionAttr(node.attrs[SUGGESTION_ATTR])) {
        if (seen.has(`${m.type}:${String(m.attrs["id"])}`)) continue;
        note(m.attrs["id"], m.type, node, pos);
      }
    }
    return true;
  });
  return [...byId.values()];
}

export function spanLabel(span: SuggestionSpan): string {
  return suggestionLabel({ kinds: span.kinds, blockLevel: span.blockLevel });
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
