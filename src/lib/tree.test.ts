import { describe, expect, it } from "vitest";
import {
  buildTree,
  canMove,
  descendantIds,
  siblingsOf,
  type TreePage,
} from "@/lib/tree";

function page(
  id: string,
  parent: string | null,
  position: string,
  overrides: Partial<TreePage> = {},
): TreePage {
  return {
    id,
    parent_page_id: parent,
    position,
    title: id,
    icon: null,
    is_private: false,
    created_by: "user-1",
    ...overrides,
  };
}

// a (a0) ─┬─ b (a0)
//         └─ c (a1) ── d (a0)
// e (a1)
const pages = [
  page("a", null, "a0"),
  page("b", "a", "a0"),
  page("c", "a", "a1"),
  page("d", "c", "a0"),
  page("e", null, "a1"),
];

describe("buildTree", () => {
  it("nests children under parents ordered by position", () => {
    const tree = buildTree(pages);
    expect(tree.map((n) => n.page.id)).toEqual(["a", "e"]);
    expect(tree[0].children.map((n) => n.page.id)).toEqual(["b", "c"]);
    expect(tree[0].children[1].children.map((n) => n.page.id)).toEqual(["d"]);
  });

  it("treats a child of an invisible parent as a root", () => {
    // e.g. the parent is a private page hidden from this viewer.
    const visible = pages.filter((p) => p.id !== "c");
    const tree = buildTree(visible);
    expect(tree.map((n) => n.page.id)).toEqual(["a", "d", "e"]);
  });

  it("handles an empty list", () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe("descendantIds", () => {
  it("collects all transitive descendants", () => {
    expect(descendantIds(pages, "a")).toEqual(new Set(["b", "c", "d"]));
  });

  it("is empty for a leaf", () => {
    expect(descendantIds(pages, "d")).toEqual(new Set());
  });
});

describe("canMove", () => {
  it("allows a move to the root", () => {
    expect(canMove(pages, "d", null)).toBe(true);
  });

  it("allows a move under an unrelated page", () => {
    expect(canMove(pages, "b", "e")).toBe(true);
  });

  it("rejects a move under itself", () => {
    expect(canMove(pages, "a", "a")).toBe(false);
  });

  it("rejects a move under its own descendant (cycle)", () => {
    expect(canMove(pages, "a", "d")).toBe(false);
  });

  it("rejects a move under a page outside the set", () => {
    expect(canMove(pages, "a", "missing")).toBe(false);
  });
});

describe("siblingsOf", () => {
  it("returns ordered siblings of a parent", () => {
    expect(siblingsOf(pages, "a").map((p) => p.id)).toEqual(["b", "c"]);
    expect(siblingsOf(pages, null).map((p) => p.id)).toEqual(["a", "e"]);
  });
});
