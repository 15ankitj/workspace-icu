import type { EditorBlock } from "@/lib/blocks";
import type { SuggestionKind } from "@/lib/suggestions";

/**
 * Suggestion markup outside the editor (Appendix A §2.4 exports). Two
 * places carry it:
 *
 * - Inline text keeps the editor's marks as `styles.suggestion` (the kind)
 *   and `styles.suggestionId`.
 * - A whole block that is itself suggested (inserted, deleted, moved, or
 *   with a suggested property change) carries `suggestion` on the block.
 *
 * Whole-block suggestions are node marks in ProseMirror, and y-prosemirror
 * syncs node attributes but not node marks. The editor therefore mirrors
 * those marks into a `suggestion` node attribute — a JSON string, so the
 * sync plugin's attribute comparison stays cheap — and that attribute is
 * what reaches collaborators, the stored Yjs document and these exports.
 */

export const SUGGESTION_ATTR = "suggestion";

export const SUGGESTION_KINDS: readonly SuggestionKind[] = [
  "insertion",
  "deletion",
  "modification",
];

export function isSuggestionKind(name: unknown): name is SuggestionKind {
  return (SUGGESTION_KINDS as readonly unknown[]).includes(name);
}

/** One suggestion mark as stored in the node attribute. */
export interface StoredMark {
  type: SuggestionKind;
  attrs: Record<string, unknown>;
}

export interface BlockSuggestion {
  kind: SuggestionKind;
  id: string;
}

/** Serialise a node's suggestion marks for the synced attribute; null
 *  when there are none, so the attribute disappears with the marks. */
export function encodeSuggestionAttr(marks: StoredMark[]): string | null {
  const kept = marks.filter((m) => isSuggestionKind(m.type));
  if (kept.length === 0) return null;
  return JSON.stringify(
    kept.map((m) => ({ type: m.type, attrs: m.attrs ?? {} })),
  );
}

export function decodeSuggestionAttr(value: unknown): StoredMark[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const { type, attrs } = entry as { type?: unknown; attrs?: unknown };
      if (!isSuggestionKind(type)) return [];
      return [
        {
          type,
          attrs:
            attrs && typeof attrs === "object"
              ? (attrs as Record<string, unknown>)
              : {},
        },
      ];
    });
  } catch {
    return [];
  }
}

/** Insertion outranks deletion outranks modification, as in the bar. */
export function dominantKind(kinds: Iterable<SuggestionKind>): SuggestionKind {
  const set = new Set(kinds);
  if (set.has("insertion")) return "insertion";
  if (set.has("deletion")) return "deletion";
  return "modification";
}

/** The block-level suggestion a node attribute describes, if any. */
export function blockSuggestionOf(value: unknown): BlockSuggestion | null {
  const marks = decodeSuggestionAttr(value);
  const withId = marks.filter((m) => m.attrs["id"] != null);
  if (withId.length === 0) return null;
  const kind = dominantKind(withId.map((m) => m.type));
  const first = withId.find((m) => m.type === kind) ?? withId[0];
  return { kind, id: String(first.attrs["id"]) };
}

interface StyledText {
  type: "text";
  text: string;
  styles?: Record<string, unknown>;
}

/** The inline suggestion on a text node, from its export styles. */
export function inlineSuggestionOf(
  styles: Record<string, unknown> | undefined,
): BlockSuggestion | null {
  const kind = styles?.["suggestion"];
  if (!isSuggestionKind(kind)) return null;
  const id = styles?.["suggestionId"];
  return { kind, id: id == null ? "" : String(id) };
}

/** Every suggestion id present in a marked document, first seen first. */
export function suggestionIdsIn(blocks: EditorBlock[]): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  const inline = (content: unknown) => {
    if (!Array.isArray(content)) return;
    for (const node of content) {
      if (!node || typeof node !== "object") continue;
      const n = node as {
        type?: string;
        styles?: Record<string, unknown>;
        content?: unknown;
      };
      if (n.type === "text") {
        const s = inlineSuggestionOf(n.styles);
        if (s) add(s.id);
      } else if (n.type === "link") {
        inline(n.content);
      }
    }
  };
  const walk = (list: EditorBlock[]) => {
    for (const block of list) {
      if (block.suggestion) add(block.suggestion.id);
      if (block.type === "table") {
        const rows =
          (block.content as { rows?: { cells?: unknown[] }[] } | undefined)
            ?.rows ?? [];
        for (const row of rows)
          for (const cell of row.cells ?? [])
            inline(
              cell && typeof cell === "object" && !Array.isArray(cell)
                ? (cell as { content?: unknown }).content
                : cell,
            );
      } else {
        inline(block.content);
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return ids;
}

export type { StyledText };
