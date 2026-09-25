import { describe, expect, it } from "vitest";
import { comparePositions } from "./position";
import { normalizeProperties } from "./page-properties";
import {
  groupReverseLinks,
  hiddenLinkCounts,
  positionForMove,
  purgeUnlinkSentence,
  relationRowByLabel,
  relationSummary,
  removedRelationRows,
  sortLinks,
  subPageChips,
  suggestReverseLabel,
  type RelationLink,
} from "./relations";

const page = (id: string, title: string, trashed = false) => ({
  id,
  title,
  icon: null,
  trashed,
});

const link = (id: string, position: string): RelationLink => ({
  id,
  position,
  page: page(`p-${id}`, id),
});

describe("suggestReverseLabel", () => {
  it("derives the reverse label from the label", () => {
    expect(suggestReverseLabel("Evidence")).toBe("Evidence for");
    expect(suggestReverseLabel("  Cases ")).toBe("Cases for");
    expect(suggestReverseLabel("")).toBe("");
    expect(suggestReverseLabel("L".repeat(50))).toHaveLength(40);
  });
});

describe("relationRowByLabel", () => {
  it("finds a relation row by label regardless of case, never another type", () => {
    const props = normalizeProperties({
      rows: [
        { id: "t", type: "text", label: "Evidence", value: "" },
        { id: "r", type: "relation", label: "Evidence" },
      ],
    });
    expect(relationRowByLabel(props, "evidence")?.id).toBe("r");
    expect(relationRowByLabel(props, "Other")).toBeNull();
  });
});

describe("groupReverseLinks", () => {
  const evidence = {
    rows: [
      {
        id: "r1",
        type: "relation",
        label: "Evidence",
        reverse_label: "Evidence for",
      },
    ],
  };
  it("groups by labels across source pages, sorts groups and pages", () => {
    const groups = groupReverseLinks([
      {
        id: "l1",
        sourcePropertyId: "r1",
        source: { ...page("kc2", "KC 12.8"), properties: evidence },
      },
      {
        id: "l2",
        sourcePropertyId: "zz",
        source: {
          ...page("kc1", "KC 12.7"),
          properties: {
            rows: [
              {
                id: "zz",
                type: "relation",
                label: "evidence",
                reverse_label: "Evidence For",
              },
            ],
          },
        },
      },
      {
        id: "l3",
        sourcePropertyId: "c",
        source: {
          ...page("teach", "Airway teaching", true),
          properties: {
            rows: [
              {
                id: "c",
                type: "relation",
                label: "Cases",
                reverse_label: "Case in",
              },
            ],
          },
        },
      },
    ]);
    expect(groups.map((g) => g.reverseLabel)).toEqual([
      "Case in",
      "Evidence for",
    ]);
    expect(groups[1].label).toBe("Evidence");
    expect(groups[1].links.map((l) => l.page.title)).toEqual([
      "KC 12.7",
      "KC 12.8",
    ]);
    expect(groups[0].links[0].page.trashed).toBe(true);
  });

  it("leaves out a link whose source page no longer declares the row", () => {
    const groups = groupReverseLinks([
      {
        id: "l1",
        sourcePropertyId: "gone",
        source: { ...page("a", "A"), properties: evidence },
      },
      {
        id: "l2",
        sourcePropertyId: "r1",
        source: {
          ...page("b", "B"),
          properties: {
            rows: [{ id: "r1", type: "text", label: "Evidence", value: "" }],
          },
        },
      },
    ]);
    expect(groups).toEqual([]);
  });
});

describe("positionForMove", () => {
  const links = sortLinks([link("c", "a2"), link("a", "a0"), link("b", "a1")]);

  it("returns a key that lands the link at the target index", () => {
    const toFront = positionForMove(links, 2, 0)!;
    expect(comparePositions(toFront, "a0")).toBeLessThan(0);
    const toEnd = positionForMove(links, 0, 2)!;
    expect(comparePositions(toEnd, "a2")).toBeGreaterThan(0);
    const between = positionForMove(links, 0, 1)!;
    expect(comparePositions(between, "a1")).toBeGreaterThan(0);
    expect(comparePositions(between, "a2")).toBeLessThan(0);
  });

  it("returns null when nothing moves or an index is out of range", () => {
    expect(positionForMove(links, 1, 1)).toBeNull();
    expect(positionForMove(links, -1, 0)).toBeNull();
    expect(positionForMove(links, 0, 3)).toBeNull();
  });
});

describe("removedRelationRows", () => {
  it("names the relation rows that disappeared, ignoring other types", () => {
    const before = normalizeProperties({
      rows: [
        { id: "r1", type: "relation", label: "Evidence" },
        { id: "r2", type: "relation", label: "Cases" },
        { id: "t", type: "text", label: "Note", value: "x" },
      ],
    });
    const after = normalizeProperties({
      rows: [{ id: "r2", type: "relation", label: "Cases renamed" }],
    });
    expect(removedRelationRows(before, after).map((r) => r.id)).toEqual(["r1"]);
    expect(removedRelationRows(after, after)).toEqual([]);
  });
});

describe("relationSummary", () => {
  it("counts links per relation row and skips empty ones", () => {
    const rows = normalizeProperties({
      rows: [
        { id: "r1", type: "relation", label: "Evidence" },
        { id: "r2", type: "relation", label: "Cases" },
      ],
    }).rows;
    expect(
      relationSummary(rows, { r1: [link("a", "a0"), link("b", "a1")] }),
    ).toEqual(["2 Evidence"]);
    expect(
      relationSummary(rows, { r1: [link("a", "a0")] }, { r1: 2, r2: 1 }),
    ).toEqual(["3 Evidence", "1 Cases"]);
  });
});

describe("hiddenLinkCounts", () => {
  it("is the total minus what RLS returned, never negative, only when positive", () => {
    expect(
      hiddenLinkCounts(
        [
          { source_property_id: "r1", total: 3 },
          { source_property_id: "r2", total: 1 },
          { source_property_id: "r3", total: 2 },
        ],
        { r1: [link("a", "a0")], r2: [link("b", "a0")], r3: [] },
      ),
    ).toEqual({ r1: 2, r3: 2 });
    expect(
      hiddenLinkCounts([{ source_property_id: "r1", total: 1 }], {
        r1: [link("a", "a0"), link("b", "a1")],
      }),
    ).toEqual({});
  });
});

describe("subPageChips", () => {
  it("takes pages across relation rows in order, three then the rest as a count", () => {
    const rows = normalizeProperties({
      rows: [
        { id: "r1", type: "relation", label: "Evidence" },
        { id: "t", type: "text", label: "Note", value: "" },
        { id: "r2", type: "relation", label: "Cases" },
      ],
    }).rows;
    const result = subPageChips(rows, {
      r1: [link("a", "a0"), link("b", "a1")],
      r2: [link("c", "a0"), link("d", "a1")],
    });
    expect(result.shown.map((p) => p.title)).toEqual(["a", "b", "c"]);
    expect(result.more).toBe(1);
    expect(subPageChips(rows, {})).toEqual({ shown: [], more: 0 });
  });
});

describe("purgeUnlinkSentence", () => {
  it("names the count and the subject, and stays quiet at zero", () => {
    expect(purgeUnlinkSentence(0, false)).toBeNull();
    expect(purgeUnlinkSentence(1, false)).toBe(
      "This page is linked from 1 other page; that link will be removed.",
    );
    expect(purgeUnlinkSentence(4, true)).toBe(
      "This page and its sub-pages are linked from 4 other pages; those links will be removed.",
    );
  });
});
