import { randomUUID } from "node:crypto";
import type { EditorBlock } from "../src/lib/blocks";

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

export const bullets = (items: (string | Inline[])[]) =>
  items.map((x) => bullet(x));
export const todos = (items: (string | Inline[])[]) =>
  items.map((x) => todo(x));

/** A placeholder the author must replace, visually distinct in the editor. */
export const fill = (what: string) => t(`«${what}»`, { italic: true });
