import { describe, expect, it } from "vitest";
import {
  MAX_ROWS,
  defaultReverseLabel,
  hasValue,
  newPropertyRow,
  normalizeProperties,
  propertiesForTemplate,
  type PagePropertyRow,
} from "./page-properties";

const USER = "11111111-2222-4333-8444-555555555555";

describe("normalizeProperties", () => {
  it("returns an empty block for anything that is not an object", () => {
    expect(normalizeProperties(null)).toEqual({ hidden: [], rows: [] });
    expect(normalizeProperties("x")).toEqual({ hidden: [], rows: [] });
    expect(normalizeProperties([])).toEqual({ hidden: [], rows: [] });
  });

  it("keeps valid rows and drops unknown types, bad ids and duplicates", () => {
    const result = normalizeProperties({
      hidden: ["created_by", "nope", "created_by"],
      rows: [
        { id: "a1", type: "people", label: "Attendees", value: [USER, "x"] },
        { id: "a1", type: "text", label: "dup", value: "ignored" },
        { id: "bad id", type: "text", label: "x", value: "y" },
        { id: "b2", type: "rollup", label: "x", value: "y" },
        { id: "c3", type: "date", label: "", value: "2026-09-12T14:00" },
        { id: "d4", type: "date", label: "When", value: "not a date" },
        { id: "e5", type: "link", label: "Ref", value: "javascript:alert(1)" },
        { id: "f6", type: "select", label: "Type", value: "  Supervision " },
      ],
    });
    expect(result.hidden).toEqual(["created_by"]);
    expect(result.rows).toEqual([
      { id: "a1", type: "people", label: "Attendees", value: [USER] },
      { id: "c3", type: "date", label: "Date", value: "2026-09-12T14:00" },
      { id: "d4", type: "date", label: "When", value: null },
      { id: "e5", type: "link", label: "Ref", value: "" },
      { id: "f6", type: "select", label: "Type", value: "Supervision" },
    ]);
  });

  it("clamps labels and text", () => {
    const result = normalizeProperties({
      rows: [
        {
          id: "t",
          type: "text",
          label: "L".repeat(80),
          value: "v".repeat(900),
        },
      ],
    });
    const row = result.rows[0];
    if (row.type !== "text") throw new Error("expected a text row");
    expect(row.label).toHaveLength(40);
    expect(row.value).toHaveLength(500);
  });
});

describe("propertiesForTemplate", () => {
  it("clears people and dates but keeps the rest", () => {
    const result = propertiesForTemplate({
      hidden: ["updated_by"],
      rows: [
        { ...newPropertyRow("people", "p"), value: [USER] },
        { ...newPropertyRow("date", "d"), value: "2026-01-01" },
        { ...newPropertyRow("select", "s"), value: "Supervision" },
      ],
    });
    expect(result.hidden).toEqual(["updated_by"]);
    expect(result.rows.map((r) => ("value" in r ? r.value : "?"))).toEqual([
      [],
      null,
      "Supervision",
    ]);
  });
});

describe("relation rows (Appendix B)", () => {
  const PAGE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  it("keeps the labels, defaults the reverse label and drops any value", () => {
    const result = normalizeProperties({
      rows: [
        { id: "r1", type: "relation", label: "Evidence", value: [PAGE] },
        {
          id: "r2",
          type: "relation",
          label: "Evidence",
          reverse_label: "  Evidence for ",
        },
        { id: "r3", type: "relation" },
      ],
    });
    expect(result.rows).toEqual([
      {
        id: "r1",
        type: "relation",
        label: "Evidence",
        reverse_label: "Related: Evidence",
      },
      {
        id: "r2",
        type: "relation",
        label: "Evidence",
        reverse_label: "Evidence for",
      },
      {
        id: "r3",
        type: "relation",
        label: "Relation",
        reverse_label: "Related: Relation",
      },
    ]);
    expect(result.rows.some((r) => "value" in r)).toBe(false);
  });

  it("clamps both labels to 40 characters, the default included", () => {
    const result = normalizeProperties({
      rows: [
        {
          id: "r",
          type: "relation",
          label: "L".repeat(80),
          reverse_label: "R".repeat(80),
        },
        { id: "s", type: "relation", label: "M".repeat(40) },
      ],
    });
    const [long, defaulted] = result.rows as Extract<
      PagePropertyRow,
      { type: "relation" }
    >[];
    expect(long.label).toHaveLength(40);
    expect(long.reverse_label).toHaveLength(40);
    expect(defaulted.reverse_label).toHaveLength(40);
    expect(defaulted.reverse_label.startsWith("Related: ")).toBe(true);
    expect(defaultReverseLabel("Evidence")).toBe("Related: Evidence");
  });

  it("keeps a well-formed reverse_of (§4.4) and drops a malformed one", () => {
    const result = normalizeProperties({
      rows: [
        {
          id: "a",
          type: "relation",
          label: "Evidence for",
          reverse_of: { page_id: PAGE.toUpperCase(), property_id: "r1" },
        },
        {
          id: "b",
          type: "relation",
          label: "Evidence for",
          reverse_of: { property_id: "r1", page_id: "not-a-uuid" },
        },
        {
          id: "c",
          type: "relation",
          label: "Evidence for",
          reverse_of: { page_id: PAGE },
        },
        { id: "d", type: "relation", label: "Evidence for", reverse_of: "r1" },
      ],
    });
    expect(
      result.rows.map((r) => (r.type === "relation" ? r.reverse_of : 1)),
    ).toEqual([
      { page_id: PAGE, property_id: "r1" },
      { property_id: "r1" },
      undefined,
      undefined,
    ]);
    expect("reverse_of" in result.rows[2]).toBe(false);
  });

  it("starts a new relation row with a derived reverse label", () => {
    expect(newPropertyRow("relation", "x")).toEqual({
      id: "x",
      type: "relation",
      label: "Relation",
      reverse_label: "Related: Relation",
    });
  });

  it("travels in templates unchanged and never counts as a value", () => {
    const row = {
      id: "r",
      type: "relation",
      label: "Evidence",
      reverse_label: "Evidence for",
    } as const;
    const result = propertiesForTemplate({ rows: [row] });
    expect(result.rows).toEqual([row]);
    expect(hasValue(row)).toBe(false);
    expect(hasValue(newPropertyRow("text", "t"))).toBe(false);
  });

  it("counts relation rows toward the row limit like any other", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `r${i}`,
      type: "relation",
      label: `R${i}`,
    }));
    expect(normalizeProperties({ rows }).rows).toHaveLength(MAX_ROWS);
  });
});
