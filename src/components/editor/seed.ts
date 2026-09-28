import type { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import type * as Y from "yjs";
import { isBlankDocument, type EditorBlock } from "@/lib/blocks";
import { fragmentToBlocks } from "@/lib/ydoc-blocks";
import { withoutSuggesting } from "@/components/editor/suggestions";

/**
 * Seeding a collaborative document from the stored `blocks` projection.
 *
 * A page (or synced block) written before its room was ever opened — a
 * template instantiation, a Phase 2 page — has rows in `blocks` and no
 * Yjs state. Once the room has synced, the editor's content has to come
 * from those rows. Two things make that harder than "is the fragment
 * empty":
 *
 * 1. The fragment is not empty by then. y-prosemirror writes the editor's
 *    initial empty paragraph to Yjs as soon as any plugin touches the
 *    initial document (our suggestions mirror does, on its first pass),
 *    so `fragment.length` is already 1 before the first sync. A check on
 *    emptiness never fires, the page shows the empty paragraph, nothing is
 *    dirty, nothing is saved — which is how every page of CESR Journey v4
 *    opened blank while `blocks` held all its content.
 * 2. Rows that did not come from the editor carry only the props they
 *    set (`{ level: 2 }`, `{ checked: false }`, `{}`), not BlockNote's
 *    full default set. BlockNote accepts partial blocks, but the rows are
 *    filled from the schema first so what lands in Yjs is what the
 *    editor would have written itself.
 *
 * So the rule is: after sync, if the live document is *blank* (nothing but
 * empty paragraphs) and the stored rows are not, replace it. That also
 * heals documents already left in that state — the empty paragraph a
 * previous open wrote — on their next open by someone who may edit,
 * without reinstalling anything.
 */

// The editor's schema generics are irrelevant here, as in suggestions.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyEditor = BlockNoteEditor<any, any, any>;
type AnyPartialBlock = PartialBlock<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The part of a BlockNote block schema this needs: each type's prop defaults. */
export type BlockPropDefaults = Record<
  string,
  { propSchema?: Record<string, { default?: unknown }> } | undefined
>;

/**
 * Every block's props completed with the schema's defaults for its type,
 * recursively. Props already set win; unknown types pass through unchanged
 * (`seedFromStoredBlocks` refuses them by name before BlockNote sees them).
 */
export function withDefaultProps(
  blocks: EditorBlock[],
  blockSchema: BlockPropDefaults,
): EditorBlock[] {
  return blocks.map((block) => {
    const defaults: Record<string, unknown> = {};
    for (const [name, prop] of Object.entries(
      blockSchema[block.type]?.propSchema ?? {},
    )) {
      if (prop.default !== undefined) defaults[name] = prop.default;
    }
    return {
      ...block,
      props: { ...defaults, ...(block.props ?? {}) },
      ...(block.children?.length && {
        children: withDefaultProps(block.children, blockSchema),
      }),
    };
  });
}

/** Block types in the document that the schema does not define. */
function unknownBlockTypes(
  blocks: EditorBlock[],
  blockSchema: BlockPropDefaults,
): string[] {
  const out = new Set<string>();
  const walk = (list: EditorBlock[]) => {
    for (const block of list) {
      if (!blockSchema[block.type]) out.add(block.type);
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return [...out];
}

export type SeedOutcome = "seeded" | "kept" | "nothing-to-seed";

/**
 * Seed the editor from `stored` when the synced document is blank. Call
 * once, after the room's first sync, from an editor who may write; the
 * replacement is stored content, not this user's edit, so it is never a
 * suggestion. Throws whatever BlockNote throws — callers surface it.
 */
export function seedFromStoredBlocks(
  editor: AnyEditor,
  fragment: Y.XmlFragment,
  stored: EditorBlock[],
): SeedOutcome {
  if (isBlankDocument(stored)) return "nothing-to-seed";
  if (!isBlankDocument(fragmentToBlocks(fragment))) return "kept";
  const blockSchema = editor.schema.blockSchema as BlockPropDefaults;
  const unknown = unknownBlockTypes(stored, blockSchema);
  if (unknown.length > 0) {
    throw new Error(
      `Stored blocks use types the editor's schema lacks: ${unknown.join(", ")}`,
    );
  }
  const blocks = withDefaultProps(stored, blockSchema);
  withoutSuggesting(editor, () =>
    editor.replaceBlocks(
      editor.document,
      // Rows are BlockNote block JSON with a looser `content` type.
      blocks as unknown as AnyPartialBlock[],
    ),
  );
  return "seeded";
}
