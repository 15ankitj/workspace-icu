import { describe, expect, it } from "vitest";
import { planExport, relativeLink, safeFilename } from "@/lib/export";
import type { TreePage } from "@/lib/tree";

function page(
  id: string,
  parent: string | null,
  position: string,
  title: string,
): TreePage {
  return {
    id,
    parent_page_id: parent,
    position,
    title,
    icon: null,
    is_private: false,
    created_by: "u",
  };
}

describe("safeFilename", () => {
  it("strips unsafe characters and diacritics", () => {
    expect(safeFilename("HiLLO 3: Airway / Émergency!")).toBe(
      "HiLLO-3-Airway-Emergency",
    );
    expect(safeFilename("   ")).toBe("untitled");
  });
});

describe("planExport", () => {
  const pages = [
    page("a", null, "a0", "Start here"),
    page("b", null, "a1", "HiLLOs"),
    page("c", "b", "a0", "HiLLO 1"),
    page("d", "b", "a1", "HiLLO 1"),
    page("e", "c", "a0", "Evidence"),
  ];

  it("orders depth-first with numbered, disambiguated paths", () => {
    expect(planExport(pages).map((e) => e.path)).toEqual([
      "01-Start-here",
      "02-HiLLOs",
      "02-HiLLOs/01-HiLLO-1",
      "02-HiLLOs/01-HiLLO-1/01-Evidence",
      "02-HiLLOs/02-HiLLO-1",
    ]);
  });

  it("exports a subtree from its root", () => {
    expect(planExport(pages, "b").map((e) => e.path)).toEqual([
      "01-HiLLOs",
      "01-HiLLOs/01-HiLLO-1",
      "01-HiLLOs/01-HiLLO-1/01-Evidence",
      "01-HiLLOs/02-HiLLO-1",
    ]);
  });
});

describe("relativeLink", () => {
  it("links across the archive tree", () => {
    expect(relativeLink("01-Start-here", "02-HiLLOs/01-HiLLO-1")).toBe(
      "./02-HiLLOs/01-HiLLO-1.md",
    );
    expect(
      relativeLink("02-HiLLOs/01-HiLLO-1/01-Evidence", "01-Start-here"),
    ).toBe("../../01-Start-here.md");
    expect(relativeLink("02-HiLLOs/01-HiLLO-1", "02-HiLLOs/02-HiLLO-1")).toBe(
      "./02-HiLLO-1.md",
    );
  });
});
