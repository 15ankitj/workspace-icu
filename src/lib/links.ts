import type { EditorBlock } from "@/lib/blocks";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Outgoing page references in a document (brief §7 page_links): page-link
 * blocks and inline page mentions, anywhere in the tree. Pure, for the
 * backlinks panel; the database keeps only targets that still exist.
 */
export function extractPageLinks(document: EditorBlock[]): string[] {
  const targets = new Set<string>();

  const visitInline = (content: unknown) => {
    if (!Array.isArray(content)) return;
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const node = item as {
        type?: string;
        props?: { pageId?: unknown };
        content?: unknown;
      };
      if (
        node.type === "pageMention" &&
        typeof node.props?.pageId === "string"
      ) {
        targets.add(node.props.pageId.toLowerCase());
      }
      // Links and table cells nest inline content.
      if (node.content) visitInline(node.content);
    }
  };

  const visit = (blocks: EditorBlock[]) => {
    for (const block of blocks) {
      if (block.type === "pageLink") {
        const pageId = (block.props as { pageId?: unknown } | undefined)
          ?.pageId;
        if (typeof pageId === "string") targets.add(pageId.toLowerCase());
      }
      const content = block.content as
        unknown[] | { rows?: { cells?: unknown[] }[] } | undefined;
      if (Array.isArray(content)) {
        visitInline(content);
      } else if (content && typeof content === "object" && "rows" in content) {
        for (const row of content.rows ?? []) {
          for (const cell of row.cells ?? []) visitInline(cell);
        }
      }
      if (block.children?.length) visit(block.children);
    }
  };

  visit(document);
  return [...targets].filter((id) => UUID_PATTERN.test(id));
}
