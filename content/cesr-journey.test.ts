import { describe, expect, it } from "vitest";
import { cesrJourney, supportingTemplates } from "./cesr-journey";
import { packToSnapshot } from "../scripts/pack-snapshot";

/** Every text run of a page's blocks, joined. */
function textOf(blocks: unknown): string {
  return JSON.stringify(blocks).replace(/\\"/g, '"');
}

describe("CESR Journey supporting templates", () => {
  const templates = supportingTemplates();
  const byName = new Map(templates.map((t) => [t.name, t]));

  it("ships the Evidence item page template (v1) with the five properties in order", () => {
    const item = byName.get("Evidence item")!;
    expect(item).toBeDefined();
    expect(item.kind).toBe("page");
    expect(item.version).toBe(1);
    expect(item.category).toBe("Training & Portfolio");
    expect(item.pages).toHaveLength(1);
    const [page] = item.pages;
    expect(
      page.properties?.map((row) => [row.id, row.type, row.label]),
    ).toEqual([
      ["type", "select", "Type"],
      ["date", "date", "Date"],
      ["consultant", "text", "Supervising consultant"],
      ["stored_as", "select", "Stored as"],
      ["link", "link", "Link"],
    ]);
    // No relation row of its own: the KC page declares the relation and
    // this page gets the reverse side (spec §4.4 design note).
    expect(page.properties?.some((row) => row.type === "relation")).toBe(false);
    const text = textOf(page.blocks);
    expect(text).toContain("Never add patient-identifiable information");
    expect(text).toContain("CBD · DOPS · Mini-CEX");
    expect(text).toContain("Described");
    expect(text).toContain("Evidence for");
    expect(text).toContain("GMC numbers removed");
    // Placeholders only; no example evidence resembling a real item.
    expect(text).not.toMatch(/\b(Mr|Mrs|Ms|Dr)\.? [A-Z][a-z]+/);
  });

  it("bumps Reflection to v3 with Date and Evidences (KC numbers) properties", () => {
    const reflection = byName.get("Reflection")!;
    expect(reflection.version).toBe(3);
    expect(reflection.changelog).toContain(
      "link it from the Evidence property of each Key Capability page",
    );
    const [page] = reflection.pages;
    expect(page.authored).toBe(true);
    expect(
      page.properties?.map((row) => [row.id, row.type, row.label]),
    ).toEqual([
      ["date", "date", "Date"],
      ["kc_note", "text", "Evidences (KC numbers)"],
    ]);
  });

  it("leaves the other supporting templates at their current versions", () => {
    const versions = Object.fromEntries(
      templates.map((t) => [t.name, t.version]),
    );
    expect(versions).toEqual({
      "Supervision meeting — Initial": 1,
      "Supervision meeting — Mid-placement": 2,
      "Supervision meeting — End-of-placement": 2,
      "Supervision meeting — Pre-submission": 1,
      Reflection: 3,
      "Evidence item": 1,
      "Evidence cover sheet": 1,
      "Personal development plan": 1,
    });
  });

  it("builds every template to format 4 with no notes and its properties kept", () => {
    for (const template of [cesrJourney(), ...templates]) {
      const built = packToSnapshot(template);
      expect(built.snapshot.format).toBe(4);
      expect(built.snapshot.notes).toEqual([]);
      for (const page of template.pages) {
        const snap = built.snapshot.pages.find((p) => p.title === page.title)!;
        expect(snap.properties?.rows.map((row) => row.id)).toEqual(
          (page.properties ?? []).map((row) => row.id),
        );
      }
    }
  });
});
