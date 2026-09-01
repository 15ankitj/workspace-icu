import { comparePositions } from "@/lib/position";

/**
 * Pure page-tree utilities shared by the sidebar and the move/reorder server
 * actions. They operate on the flat `pages` rows and know nothing about
 * Supabase, so they can be unit-tested directly.
 */

export interface TreePage {
  id: string;
  parent_page_id: string | null;
  position: string;
  title: string;
  icon: string | null;
  is_private: boolean;
  created_by: string;
}

export interface PageNode<T extends TreePage = TreePage> {
  page: T;
  children: PageNode<T>[];
}

/** Build a nested tree from flat rows, ordering siblings by position. */
export function buildTree<T extends TreePage>(pages: T[]): PageNode<T>[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(pages.map((p) => p.id));
  for (const page of pages) {
    // A parent outside the fetched set (e.g. a private page hidden from this
    // viewer) makes the child a root, so nothing silently disappears.
    const key =
      page.parent_page_id && ids.has(page.parent_page_id)
        ? page.parent_page_id
        : null;
    const list = byParent.get(key) ?? [];
    list.push(page);
    byParent.set(key, list);
  }
  const build = (parentId: string | null): PageNode<T>[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => comparePositions(a.position, b.position))
      .map((page) => ({ page, children: build(page.id) }));
  return build(null);
}

/** All descendant ids of `pageId`, not including itself. */
export function descendantIds(pages: TreePage[], pageId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const p of pages) {
    if (p.parent_page_id) {
      const list = children.get(p.parent_page_id) ?? [];
      list.push(p.id);
      children.set(p.parent_page_id, list);
    }
  }
  const out = new Set<string>();
  const stack = [...(children.get(pageId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/**
 * A move is invalid when it would parent a page under itself or one of its
 * own descendants (a cycle), or under a page that does not exist in the set.
 */
export function canMove(
  pages: TreePage[],
  pageId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return true;
  if (newParentId === pageId) return false;
  if (!pages.some((p) => p.id === newParentId)) return false;
  return !descendantIds(pages, pageId).has(newParentId);
}

/** Ordered siblings under a parent, for computing a drop position. */
export function siblingsOf(
  pages: TreePage[],
  parentId: string | null,
): TreePage[] {
  return pages
    .filter((p) => p.parent_page_id === parentId)
    .sort((a, b) => comparePositions(a.position, b.position));
}
