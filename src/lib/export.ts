import { buildTree, type PageNode, type TreePage } from "@/lib/tree";

/** Filesystem-safe name for a page title (brief §5 Markdown export). */
export function safeFilename(title: string, fallback = "untitled"): string {
  const cleaned = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return cleaned || fallback;
}

export interface ExportEntry<T extends TreePage = TreePage> {
  page: T;
  /** Path inside the archive, without extension, unique. */
  path: string;
  depth: number;
}

/**
 * Flatten a page tree into archive entries: each page becomes
 * `<ancestors>/<title>` with a numeric prefix to keep sibling order and
 * a suffix to disambiguate duplicate titles.
 */
export function planExport<T extends TreePage>(
  pages: T[],
  rootId: string | null = null,
): ExportEntry<T>[] {
  const tree = buildTree(pages);
  const roots: PageNode<T>[] = rootId
    ? [findNode(tree, rootId)].filter((n): n is PageNode<T> => n !== null)
    : tree;

  const entries: ExportEntry<T>[] = [];
  const walk = (nodes: PageNode<T>[], prefix: string, depth: number) => {
    const used = new Map<string, number>();
    nodes.forEach((node, index) => {
      const base = `${String(index + 1).padStart(2, "0")}-${safeFilename(node.page.title)}`;
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      const name = count > 1 ? `${base}-${count}` : base;
      const path = prefix ? `${prefix}/${name}` : name;
      entries.push({ page: node.page, path, depth });
      if (node.children.length) walk(node.children, path, depth + 1);
    });
  };
  walk(roots, "", 0);
  return entries;
}

function findNode<T extends TreePage>(
  nodes: PageNode<T>[],
  id: string,
): PageNode<T> | null {
  for (const node of nodes) {
    if (node.page.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Relative Markdown link from one archive entry to another. */
export function relativeLink(fromPath: string, toPath: string): string {
  const from = fromPath.split("/").slice(0, -1);
  const to = toPath.split("/");
  let common = 0;
  while (
    common < from.length &&
    common < to.length - 1 &&
    from[common] === to[common]
  ) {
    common++;
  }
  const up = from.length - common;
  const rest = to.slice(common);
  const segments = [...Array(up).fill(".."), ...rest];
  const rel = segments.join("/") + ".md";
  return rel.startsWith(".") ? rel : `./${rel}`;
}
