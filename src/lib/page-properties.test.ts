import { describe, expect, it } from "vitest";
import {
  newPropertyRow,
  normalizeProperties,
  propertiesForTemplate,
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
    expect(result.rows[0].label).toHaveLength(40);
    expect(result.rows[0].value).toHaveLength(500);
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
    expect(result.rows.map((r) => r.value)).toEqual([[], null, "Supervision"]);
  });
});
