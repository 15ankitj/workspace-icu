import { describe, expect, it } from "vitest";
import { normalizeProperties } from "./page-properties";
import {
  propertyLines,
  propertyLinesToMarkdown,
  type PropertyExportContext,
} from "./property-export";

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "22222222-2222-4333-8444-555555555555";

const ctx: PropertyExportContext = {
  memberName: (id) => (id === USER ? "Dr Example" : null),
  pageHref: (id) => (id === "b" ? "./02-B.md" : null),
  links: {
    r1: [
      {
        id: "l1",
        position: "a0",
        page: { id: "b", title: "B", icon: null, trashed: false },
      },
      {
        id: "l2",
        position: "a1",
        page: { id: "c", title: "C", icon: "📄", trashed: true },
      },
      {
        id: "l3",
        position: "a2",
        page: { id: "d", title: "", icon: null, trashed: false },
      },
    ],
  },
  reverse: [
    {
      key: "k",
      label: "Evidence",
      reverseLabel: "Evidence for",
      links: [
        {
          id: "l9",
          page: { id: "kc", title: "KC 12.7", icon: null, trashed: false },
        },
      ],
    },
    { key: "empty", label: "Cases", reverseLabel: "Case in", links: [] },
  ],
};

const props = normalizeProperties({
  rows: [
    { id: "p", type: "people", label: "Attendees", value: [USER, OTHER] },
    { id: "d", type: "date", label: "When", value: "2026-09-12" },
    { id: "s", type: "select", label: "Type", value: "Supervision" },
    { id: "l", type: "link", label: "Ref", value: "https://example.org/x" },
    { id: "t", type: "text", label: "Note", value: "a *starred* note" },
    { id: "e", type: "text", label: "Empty", value: "" },
    {
      id: "r1",
      type: "relation",
      label: "Evidence",
      reverse_label: "Evidence for",
    },
    { id: "r2", type: "relation", label: "Cases", reverse_label: "Case in" },
  ],
});

describe("propertyLines", () => {
  it("renders every type with a value, relations both ways, and skips the rest", () => {
    const lines = propertyLines(props, ctx);
    expect(lines.map((l) => l.label)).toEqual([
      "Attendees",
      "When",
      "Type",
      "Ref",
      "Note",
      "Evidence",
      "Evidence for",
    ]);
    expect(lines[0].parts[0].text).toBe("Dr Example, A former member");
    expect(lines[1].parts[0].text).toBe("12 Sept 2026");
    expect(lines[3].parts[0]).toEqual({
      text: "https://example.org/x",
      href: "https://example.org/x",
    });
    expect(lines[5].parts).toEqual([
      { text: "B", href: "./02-B.md" },
      { text: "C (in trash)", href: null, muted: true },
      { text: "Untitled", href: null },
    ]);
    expect(lines[6].parts).toEqual([{ text: "KC 12.7", href: null }]);
  });

  it("is empty for a page with nothing to show", () => {
    expect(
      propertyLines(normalizeProperties(null), {
        ...ctx,
        links: {},
        reverse: [],
      }),
    ).toEqual([]);
  });
});

describe("propertyLinesToMarkdown", () => {
  it("writes one bold-labelled line per property with links and escapes", () => {
    const md = propertyLinesToMarkdown(propertyLines(props, ctx));
    expect(md).toContain("**Note:** a \\*starred\\* note");
    expect(md).toContain(
      "**Ref:** [https://example.org/x](https://example.org/x)",
    );
    expect(md).toContain(
      "**Evidence:** [B](./02-B.md), _C (in trash)_, Untitled  \n**Evidence for:** KC 12.7\n\n",
    );
    expect(md.split("  \n")).toHaveLength(7);
    expect(propertyLinesToMarkdown([])).toBe("");
  });
});
