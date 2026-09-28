import { randomUUID } from "node:crypto";
import type { EditorBlock } from "../src/lib/blocks";
import type { PagePropertyRow } from "../src/lib/page-properties";

/**
 * Tiny authoring DSL for content packs. Produces editor block documents
 * that round-trip through the app's snapshot/instantiate path exactly as
 * if they had been typed in the editor.
 */

export type Inline = {
  type: "text";
  text: string;
  styles: Record<string, boolean>;
};

export function t(text: string, styles: Record<string, boolean> = {}): Inline {
  return { type: "text", text, styles };
}
export const b = (text: string) => t(text, { bold: true });
export const i = (text: string) => t(text, { italic: true });

function inline(content: string | Inline[]): Inline[] {
  return typeof content === "string" ? [t(content)] : content;
}

function block(
  type: string,
  props: Record<string, unknown> = {},
  content?: unknown,
  children: EditorBlock[] = [],
): EditorBlock {
  return { id: randomUUID(), type, props, content, children };
}

export const p = (content: string | Inline[] = "") =>
  block("paragraph", {}, inline(content));
export const h1 = (content: string) =>
  block("heading", { level: 1 }, inline(content));
export const h2 = (content: string) =>
  block("heading", { level: 2 }, inline(content));
export const h3 = (content: string) =>
  block("heading", { level: 3 }, inline(content));
export const todo = (
  content: string | Inline[],
  children: EditorBlock[] = [],
) => block("checkListItem", { checked: false }, inline(content), children);
export const bullet = (
  content: string | Inline[],
  children: EditorBlock[] = [],
) => block("bulletListItem", {}, inline(content), children);
export const numbered = (
  content: string | Inline[],
  children: EditorBlock[] = [],
) => block("numberedListItem", {}, inline(content), children);
export const toggle = (summary: string, children: EditorBlock[]) =>
  block("toggleListItem", {}, inline(summary), children);
export const quote = (content: string | Inline[]) =>
  block("quote", {}, inline(content));
export const divider = () => block("divider", {});
export const callout = (
  emoji: string,
  content: string | Inline[],
  colour: "gray" | "blue" | "green" | "yellow" | "red" = "blue",
  children: EditorBlock[] = [],
) => block("callout", { emoji, colour }, inline(content), children);
export const bookmark = (url: string, title: string, description = "") =>
  block("bookmark", { url, title, description });
export const pageLink = (pageId: string, title: string, icon = "") =>
  block("pageLink", { pageId, title, icon });
export const toc = () => block("tableOfContents", {});
export const table = (rows: (string | Inline[])[][]) =>
  block(
    "table",
    {},
    {
      type: "tableContent",
      rows: rows.map((cells) => ({ cells: cells.map(inline) })),
    },
  );

/**
 * A placement of a synced block (Appendix A). `id` is the block's id in
 * the pack; the snapshot builder rewrites it to the block's stable key.
 */
export const synced = (id: string, readOnly = false) =>
  block("syncedBlock", { syncedBlockId: id, readOnly });

export const bullets = (items: (string | Inline[])[]) =>
  items.map((x) => bullet(x));
export const todos = (items: (string | Inline[])[]) =>
  items.map((x) => todo(x));

/** A placeholder the author must replace, visually distinct in the editor. */
export const fill = (what: string) => t(`«${what}»`, { italic: true });

/**
 * Inline markdown emphasis to text runs: `**bold**`, `*italic*`, and bold
 * containing italic (`**has *required* evidence**`). Nothing else is
 * interpreted, so source text that is not markup passes through as is.
 * Used for curriculum data copied from the markdown source files.
 */
export function md(text: string): Inline[] {
  const runs: Inline[] = [];
  let bold = false;
  let italic = false;
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const styles: Record<string, boolean> = {};
    if (bold) styles.bold = true;
    if (italic) styles.italic = true;
    runs.push(t(buffer, styles));
    buffer = "";
  };
  for (let index = 0; index < text.length; index++) {
    if (text.startsWith("**", index)) {
      flush();
      bold = !bold;
      index += 1;
    } else if (text[index] === "*") {
      flush();
      italic = !italic;
    } else {
      buffer += text[index];
    }
  }
  flush();
  return runs;
}

/**
 * Page details rows (migration 0014, Appendix B) as a pack page carries
 * them. Ids are stable strings the author chooses (`status`, `evidence`),
 * not UUIDs, so a later pack version can find and extend the same rows;
 * they must match the app's id pattern (`^[A-Za-z0-9_-]{1,40}$`), which
 * the build script checks. People and date values never travel in a
 * template (`propertiesForTemplate` clears them), so those helpers take
 * no value; select, text and link values do travel and are the seed the
 * copy starts with. A relation row only declares the property — the
 * pages it holds are the template's `relations`.
 */
export const prop = {
  select: (
    id: string,
    label: string,
    value: string | null = null,
  ): PagePropertyRow => ({ id, type: "select", label, value }),
  date: (id: string, label: string): PagePropertyRow => ({
    id,
    type: "date",
    label,
    value: null,
  }),
  people: (id: string, label: string): PagePropertyRow => ({
    id,
    type: "people",
    label,
    value: [],
  }),
  text: (id: string, label: string, value = ""): PagePropertyRow => ({
    id,
    type: "text",
    label,
    value,
  }),
  link: (id: string, label: string, value = ""): PagePropertyRow => ({
    id,
    type: "link",
    label,
    value,
  }),
  relation: (
    id: string,
    label: string,
    reverseLabel: string,
  ): PagePropertyRow => ({
    id,
    type: "relation",
    label,
    reverse_label: reverseLabel,
  }),
};
