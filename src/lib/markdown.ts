import type { EditorBlock } from "@/lib/blocks";

/**
 * Block document → Markdown (brief §5 export). Pure and deterministic;
 * covers the whole v1 block list. Lossy where Markdown has no equivalent
 * (callout colour, embeds become links, table of contents is dropped).
 */

export interface MarkdownContext {
  /** Title for an internal page reference, or null if unknown. */
  pageTitle: (pageId: string) => string | null;
  /** Link target for an internal page reference. */
  pageHref: (pageId: string) => string;
  /** Link target for an attached file, given its id. */
  fileHref: (fileId: string) => string;
}

const FILE_URL = /^\/api\/files\/([A-Za-z0-9-]+)$/;

function resolveUrl(url: unknown, ctx: MarkdownContext): string {
  if (typeof url !== "string") return "";
  const match = url.match(FILE_URL);
  return match ? ctx.fileHref(match[1]) : url;
}

function escapeText(text: string): string {
  return text.replace(/([\\`*_{}[\]<>#+!|])/g, "\\$1");
}

interface StyledText {
  type: "text";
  text: string;
  styles?: Record<string, unknown>;
}

function styledText(node: StyledText): string {
  let out = escapeText(node.text);
  if (!out.trim()) return node.text; // keep pure whitespace verbatim
  const s = node.styles ?? {};
  if (s.code) out = `\`${node.text}\``;
  if (s.bold) out = `**${out}**`;
  if (s.italic) out = `*${out}*`;
  if (s.strike) out = `~~${out}~~`;
  if (s.underline) out = `<u>${out}</u>`;
  return out;
}

export function inlineToMarkdown(
  content: unknown,
  ctx: MarkdownContext,
): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => {
      if (!node || typeof node !== "object") return "";
      const n = node as {
        type?: string;
        text?: string;
        styles?: Record<string, unknown>;
        href?: string;
        content?: unknown;
        props?: Record<string, unknown>;
      };
      switch (n.type) {
        case "text":
          return styledText(n as StyledText);
        case "link":
          return `[${inlineToMarkdown(n.content, ctx)}](${n.href ?? ""})`;
        case "userMention":
          return `@${String(n.props?.name ?? "someone")}`;
        case "pageMention": {
          const id = String(n.props?.pageId ?? "");
          const title =
            ctx.pageTitle(id) ?? String(n.props?.title ?? "") ?? "page";
          return `[${escapeText(title || "page")}](${ctx.pageHref(id)})`;
        }
        default:
          return "";
      }
    })
    .join("");
}

function tableToMarkdown(content: unknown, ctx: MarkdownContext): string {
  const rows = (content as { rows?: { cells?: unknown[] }[] } | undefined)
    ?.rows;
  if (!rows?.length) return "";
  const lines = rows.map(
    (row) =>
      `| ${(row.cells ?? [])
        .map((cell) => {
          // Cells are inline arrays, or {content: inline[]} in newer formats.
          const inline =
            cell && typeof cell === "object" && !Array.isArray(cell)
              ? (cell as { content?: unknown }).content
              : cell;
          // Pipes are already escaped by the inline serializer.
          return inlineToMarkdown(inline, ctx) || " ";
        })
        .join(" | ")} |`,
  );
  const columns = rows[0].cells?.length ?? 1;
  lines.splice(1, 0, `| ${Array(columns).fill("---").join(" | ")} |`);
  return lines.join("\n");
}

function indent(text: string, depth: number): string {
  const pad = "  ".repeat(depth);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function blockToMarkdown(
  block: EditorBlock,
  ctx: MarkdownContext,
  depth: number,
  listIndex: number,
): string {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const inline = inlineToMarkdown(block.content, ctx);
  const children = block.children?.length
    ? "\n" + blocksToMarkdownInner(block.children, ctx, depth + 1)
    : "";

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(props.level) || 1, 1), 3);
      return `${"#".repeat(level)} ${inline}${children}`;
    }
    case "bulletListItem":
      return `- ${inline}${children}`;
    case "numberedListItem":
      return `${listIndex}. ${inline}${children}`;
    case "checkListItem":
      return `- [${props.checked ? "x" : " "}] ${inline}${children}`;
    case "toggleListItem":
      return `- ${inline}${children}`;
    case "quote":
      return `> ${inline}${children}`;
    case "divider":
      return `---${children}`;
    case "codeBlock": {
      const code = Array.isArray(block.content)
        ? block.content.map((c) => (c as { text?: string }).text ?? "").join("")
        : "";
      return `\`\`\`${String(props.language ?? "")}\n${code}\n\`\`\`${children}`;
    }
    case "table":
      return `${tableToMarkdown(block.content, ctx)}${children}`;
    case "image": {
      const url = resolveUrl(props.url, ctx);
      const caption = escapeText(String(props.caption ?? ""));
      return `![${caption}](${url})${caption ? `\n*${caption}*` : ""}${children}`;
    }
    case "file": {
      const url = resolveUrl(props.url, ctx);
      const name = escapeText(String(props.name ?? props.caption ?? "file"));
      return `[${name}](${url})${children}`;
    }
    case "callout":
      return `> ${String(props.emoji ?? "💡")} ${inline}${children}`;
    case "embed":
    case "bookmark": {
      const url = String(props.url ?? "");
      const title = escapeText(String(props.title ?? "")) || url;
      return url ? `[${title}](${url})${children}` : children.trim();
    }
    case "pageLink": {
      const id = String(props.pageId ?? "");
      const title = ctx.pageTitle(id) ?? String(props.title ?? "") ?? "page";
      return `[${escapeText(title || "page")}](${ctx.pageHref(id)})${children}`;
    }
    case "tableOfContents":
      return children.trim();
    case "paragraph":
    default:
      return `${inline}${children}`;
  }
}

function blocksToMarkdownInner(
  blocks: EditorBlock[],
  ctx: MarkdownContext,
  depth: number,
): string {
  const parts: string[] = [];
  let listIndex = 0;
  for (const block of blocks) {
    listIndex = block.type === "numberedListItem" ? listIndex + 1 : 0;
    const md = blockToMarkdown(block, ctx, depth, listIndex);
    parts.push(depth > 0 ? indent(md, depth) : md);
  }
  // List items are separated by single newlines; other blocks by blank lines.
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const isList = /ListItem$/.test(blocks[i].type);
    const prevList = i > 0 && /ListItem$/.test(blocks[i - 1].type);
    if (i > 0) out += isList && prevList ? "\n" : "\n\n";
    out += parts[i];
  }
  return out;
}

export function blocksToMarkdown(
  document: EditorBlock[],
  ctx: MarkdownContext,
): string {
  return blocksToMarkdownInner(document, ctx, 0).trim() + "\n";
}

/** Attached file ids referenced anywhere in a document. */
export function fileIdsIn(document: EditorBlock[]): string[] {
  const ids = new Set<string>();
  for (const match of JSON.stringify(document).matchAll(
    /\/api\/files\/([A-Za-z0-9-]+)/g,
  )) {
    ids.add(match[1]);
  }
  return [...ids];
}
