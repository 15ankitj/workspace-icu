import { firstPosition, positionAfter, comparePositions } from "@/lib/position";

/**
 * Conversion between the editor's nested document (BlockNote `Block[]`)
 * and the flat `blocks` rows the database stores. Pure and structural so
 * it can be unit-tested; the editor's own types are cast at the component
 * boundary.
 */

export interface EditorBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: EditorBlock[];
  /** Present only in "with markup" exports: this whole block is a
   *  suggestion (Appendix A §2.4). Never stored. */
  suggestion?: { kind: "insertion" | "deletion" | "modification"; id: string };
}

/** True when an inline-content array carries no text or inline object. */
function hasInlineContent(content: unknown): boolean {
  if (!Array.isArray(content)) return content !== undefined && content !== null;
  return content.some((item) => {
    if (!item || typeof item !== "object") return false;
    const run = item as { type?: unknown; text?: unknown; content?: unknown };
    if (run.type === "text") {
      return typeof run.text === "string" && run.text.trim().length > 0;
    }
    if (run.type === "link") return hasInlineContent(run.content);
    return true; // a mention or other inline object is content
  });
}

/**
 * A document that says nothing: no blocks, or only paragraphs with no
 * text and no children — what a collaborative editor holds before anyone
 * has typed (its initial empty paragraph). Used to decide whether a
 * synced document should be seeded from the stored `blocks` rows.
 */
export function isBlankDocument(blocks: EditorBlock[]): boolean {
  return blocks.every(
    (block) =>
      block.type === "paragraph" &&
      !(block.children && block.children.length > 0) &&
      !hasInlineContent(block.content),
  );
}

export interface BlockRowInput {
  id: string;
  parent_block_id: string | null;
  type: string;
  position: string;
  content: { props?: Record<string, unknown>; content?: unknown };
}

/**
 * Flatten a document to rows, parents before children (the insert relies
 * on that order only within a statement; the FK is checked at statement
 * end), siblings given sequential fractional positions.
 */
export function flattenDocument(document: EditorBlock[]): BlockRowInput[] {
  const rows: BlockRowInput[] = [];
  const seen = new Set<string>();

  const walk = (blocks: EditorBlock[], parentId: string | null) => {
    let position: string | null = null;
    for (const block of blocks) {
      if (!block.id || seen.has(block.id)) {
        throw new Error("Blocks must have unique ids");
      }
      seen.add(block.id);
      position = position === null ? firstPosition() : positionAfter(position);
      rows.push({
        id: block.id,
        parent_block_id: parentId,
        type: block.type,
        position,
        content: {
          ...(block.props !== undefined && { props: block.props }),
          ...(block.content !== undefined && { content: block.content }),
        },
      });
      if (block.children?.length) walk(block.children, block.id);
    }
  };

  walk(document, null);
  return rows;
}

export interface BlockRowFromDb {
  id: string;
  parent_block_id: string | null;
  type: string;
  position: string;
  content: { props?: Record<string, unknown>; content?: unknown } | null;
}

/** Rebuild the nested document from rows; inverse of flattenDocument. */
export function buildDocument(rows: BlockRowFromDb[]): EditorBlock[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, BlockRowFromDb[]>();
  for (const row of rows) {
    // An orphaned parent reference degrades to a root block rather than
    // dropping content.
    const key =
      row.parent_block_id && ids.has(row.parent_block_id)
        ? row.parent_block_id
        : null;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }

  const build = (parentId: string | null): EditorBlock[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => comparePositions(a.position, b.position))
      .map((row) => ({
        id: row.id,
        type: row.type,
        ...(row.content?.props !== undefined && { props: row.content.props }),
        ...(row.content?.content !== undefined && {
          content: row.content.content,
        }),
        children: build(row.id),
      }));

  return build(null);
}

/** Guard rails for the save path. */
export const MAX_BLOCKS_PER_PAGE = 5000;
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
