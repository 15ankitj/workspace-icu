import * as Y from "yjs";
import type { EditorBlock } from "@/lib/blocks";
import {
  blockSuggestionOf,
  isSuggestionKind,
  SUGGESTION_ATTR,
} from "@/lib/suggestion-markup";

/**
 * Read a stored Yjs document straight into the block JSON the exporters
 * consume, keeping suggestion markup (Appendix A §2.4 "with markup").
 *
 * The saved `blocks` projection is the clean state — every suggestion
 * reverted — so the markup can only come from the Yjs document itself.
 * This walks the y-prosemirror shape of a BlockNote document (elements
 * named after ProseMirror nodes, attributes for node attrs, XmlText with
 * marks as delta attributes) without loading an editor: it runs in a
 * route handler on the server and mirrors BlockNote's `nodeToBlock` for
 * everything the Markdown serializer and print renderer read.
 */

/** Blocks whose content is `none` in the schema: nothing inline inside. */
const NO_CONTENT = new Set([
  "image",
  "file",
  "video",
  "audio",
  "divider",
  "tableOfContents",
  "pageLink",
  "embed",
  "bookmark",
  "syncedBlock",
]);

const BOOLEAN_STYLES = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
]);
const STRING_STYLES = new Set(["textColor", "backgroundColor"]);

// y-prosemirror suffixes overlapping marks with "--<hash>".
const HASHED = /(.*)(--[a-zA-Z0-9+/=]{8})$/;
function markName(attr: string): string {
  return HASHED.exec(attr)?.[1] ?? attr;
}

export function decodeYDoc(bytes: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, bytes);
  return doc;
}

/** The blocks of a stored document, with markup. `fragment` is the
 *  XmlFragment name the editor binds to ("document" for pages and synced
 *  blocks alike). */
export function ydocToBlocks(
  bytes: Uint8Array,
  fragment = "document",
): EditorBlock[] {
  const doc = decodeYDoc(bytes);
  try {
    return fragmentToBlocks(doc.getXmlFragment(fragment));
  } finally {
    doc.destroy();
  }
}

export function fragmentToBlocks(fragment: Y.XmlFragment): EditorBlock[] {
  const out: EditorBlock[] = [];
  for (const child of fragment.toArray()) {
    if (child instanceof Y.XmlElement && child.nodeName === "blockGroup") {
      out.push(...groupToBlocks(child));
    }
  }
  return out;
}

function groupToBlocks(group: Y.XmlElement): EditorBlock[] {
  const out: EditorBlock[] = [];
  for (const child of group.toArray()) {
    if (child instanceof Y.XmlElement && child.nodeName === "blockContainer") {
      const block = containerToBlock(child);
      if (block) out.push(block);
    }
  }
  return out;
}

function containerToBlock(container: Y.XmlElement): EditorBlock | null {
  const containerAttrs = container.getAttributes();
  let content: Y.XmlElement | null = null;
  let childGroup: Y.XmlElement | null = null;
  for (const child of container.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue;
    if (child.nodeName === "blockGroup") childGroup = child;
    else if (!content) content = child;
  }
  if (!content) return null;
  const contentAttrs = content.getAttributes();
  const type = content.nodeName;

  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    ...containerAttrs,
    ...contentAttrs,
  })) {
    if (
      key === "id" ||
      key === SUGGESTION_ATTR ||
      isSuggestionKind(markName(key))
    )
      continue;
    props[key] = value;
  }

  const block: EditorBlock = {
    id: String(containerAttrs["id"] ?? ""),
    type,
    props,
    content: blockContent(type, content),
    children: childGroup ? groupToBlocks(childGroup) : [],
  };
  const suggestion =
    blockSuggestionOf(containerAttrs[SUGGESTION_ATTR]) ??
    blockSuggestionOf(contentAttrs[SUGGESTION_ATTR]);
  if (suggestion) block.suggestion = suggestion;
  return block;
}

function blockContent(type: string, node: Y.XmlElement): unknown {
  if (NO_CONTENT.has(type)) return undefined;
  if (type === "table") return tableContent(node);
  if (type === "codeBlock") {
    const text = plainText(node);
    return text.length > 0 ? [{ type: "text", text, styles: {} }] : [];
  }
  return inlineContent(node);
}

function plainText(node: Y.XmlElement): string {
  let text = "";
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText)
      text += child.toString().replace(/<[^>]*>/g, "");
    else if (child instanceof Y.XmlElement) text += plainText(child);
  }
  return text;
}

function tableContent(table: Y.XmlElement) {
  const rows: { cells: unknown[] }[] = [];
  const columnWidths: (number | null)[] = [];
  let headerRows: number | undefined;
  const headerMatrix: boolean[][] = [];
  table.toArray().forEach((rowNode, rowIndex) => {
    if (!(rowNode instanceof Y.XmlElement)) return;
    const cells: unknown[] = [];
    const headers: boolean[] = [];
    rowNode.toArray().forEach((cellNode) => {
      if (!(cellNode instanceof Y.XmlElement)) return;
      const attrs = cellNode.getAttributes();
      if (rowIndex === 0) {
        const width = attrs["colwidth"];
        if (Array.isArray(width)) columnWidths.push(...(width as number[]));
        else
          columnWidths.push(
            ...new Array(Number(attrs["colspan"] ?? 1)).fill(null),
          );
      }
      headers.push(cellNode.nodeName === "tableHeader");
      const content = cellNode
        .toArray()
        .filter((p): p is Y.XmlElement => p instanceof Y.XmlElement)
        .map((paragraph) => inlineContent(paragraph))
        .reduce<unknown[]>((acc, part) => {
          if (acc.length === 0) return part;
          const last = acc[acc.length - 1] as {
            type?: string;
            text?: string;
            styles?: unknown;
          };
          const first = part[0] as
            { type?: string; text?: string; styles?: unknown } | undefined;
          if (
            first &&
            last.type === "text" &&
            first.type === "text" &&
            JSON.stringify(last.styles) === JSON.stringify(first.styles)
          ) {
            last.text += "\n" + first.text;
            acc.push(...part.slice(1));
            return acc;
          }
          acc.push(...part);
          return acc;
        }, []);
      cells.push({
        type: "tableCell",
        content,
        props: {
          colspan: attrs["colspan"],
          rowspan: attrs["rowspan"],
          backgroundColor: attrs["backgroundColor"],
          textColor: attrs["textColor"],
          textAlignment: attrs["textAlignment"],
        },
      });
    });
    headerMatrix.push(headers);
    rows.push({ cells });
  });
  for (const row of headerMatrix) {
    if (row.length && row.every(Boolean)) headerRows = (headerRows ?? 0) + 1;
  }
  return { type: "tableContent", columnWidths, headerRows, rows };
}

interface TextPart {
  type: "text";
  text: string;
  styles: Record<string, unknown>;
}
interface LinkPart {
  type: "link";
  href: string;
  content: TextPart[];
}

function inlineContent(node: Y.XmlElement): unknown[] {
  const out: unknown[] = [];
  let current: TextPart | LinkPart | null = null;
  // Styles of the text being built, for a hard break that continues it.
  const currentStyles = (): Record<string, unknown> => {
    const c = current as TextPart | LinkPart | null;
    return c && c.type === "text" ? c.styles : {};
  };

  const pushText = (
    text: string,
    styles: Record<string, unknown>,
    href: string | null,
  ) => {
    if (current && current.type === "text") {
      if (!href) {
        if (JSON.stringify(current.styles) === JSON.stringify(styles)) {
          current.text += text;
          return;
        }
        out.push(current);
        current = { type: "text", text, styles };
        return;
      }
      out.push(current);
      current = {
        type: "link",
        href,
        content: [{ type: "text", text, styles }],
      };
      return;
    }
    if (current && current.type === "link") {
      if (href) {
        if (current.href === href) {
          const last = current.content[current.content.length - 1];
          if (JSON.stringify(last.styles) === JSON.stringify(styles))
            last.text += text;
          else current.content.push({ type: "text", text, styles });
          return;
        }
        out.push(current);
        current = {
          type: "link",
          href,
          content: [{ type: "text", text, styles }],
        };
        return;
      }
      out.push(current);
      current = { type: "text", text, styles };
      return;
    }
    current = href
      ? { type: "link", href, content: [{ type: "text", text, styles }] }
      : { type: "text", text, styles };
  };

  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      for (const delta of child.toDelta() as {
        insert: unknown;
        attributes?: Record<string, unknown>;
      }[]) {
        if (typeof delta.insert !== "string") continue;
        const styles: Record<string, unknown> = {};
        let href: string | null = null;
        let kind: string | null = null;
        let suggestionId: unknown = null;
        for (const [rawName, value] of Object.entries(delta.attributes ?? {})) {
          const name = markName(rawName);
          const attrs = (value ?? {}) as Record<string, unknown>;
          if (name === "link") href = String(attrs["href"] ?? "");
          else if (BOOLEAN_STYLES.has(name)) styles[name] = true;
          else if (STRING_STYLES.has(name)) styles[name] = attrs["stringValue"];
          else if (isSuggestionKind(name)) {
            // Insertion outranks deletion outranks modification.
            if (
              kind === null ||
              name === "insertion" ||
              (name === "deletion" && kind === "modification")
            ) {
              kind = name;
              suggestionId = attrs["id"];
            }
          }
        }
        if (kind) {
          styles["suggestion"] = kind;
          styles["suggestionId"] =
            suggestionId == null ? "" : String(suggestionId);
        }
        pushText(delta.insert, styles, href);
      }
    } else if (child instanceof Y.XmlElement) {
      if (child.nodeName === "hardBreak") {
        pushText("\n", currentStyles(), null);
        continue;
      }
      if (current) {
        out.push(current);
        current = null;
      }
      const attrs = child.getAttributes();
      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(attrs)) {
        if (key === SUGGESTION_ATTR) continue;
        props[key] = value;
      }
      out.push({ type: child.nodeName, props, content: undefined });
    }
  }
  if (current) out.push(current);
  return out;
}
