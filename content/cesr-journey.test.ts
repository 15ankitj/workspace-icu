import { describe, expect, it } from "vitest";
import { CESR_CURRICULUM } from "./cesr-curriculum";
import { hilloTitle, KC_PROPERTY_IDS, summaryKey } from "./cesr-hillo-pages";
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

  it("carries the v4 versions of the supporting templates", () => {
    const versions = Object.fromEntries(
      templates.map((t) => [t.name, t.version]),
    );
    expect(versions).toEqual({
      "Supervision meeting — Initial": 1,
      "Supervision meeting — Mid-placement": 3,
      "Supervision meeting — End-of-placement": 3,
      "Supervision meeting — Pre-submission": 2,
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

describe("CESR Journey v4 workspace template", () => {
  const journey = cesrJourney();
  const built = packToSnapshot(journey);
  const { snapshot } = built;
  const byKey = new Map(snapshot.pages.map((page) => [page.key, page]));
  const titleOf = (key: string | null) => (key ? byKey.get(key)?.title : null);

  it("is version 4 with the spec's changelog and no Evidence index", () => {
    expect(journey.version).toBe(4);
    expect(journey.changelog).toContain("One page per Key Capability");
    expect(journey.changelog).toContain("Evidence index page removed");
    expect(journey.pages.map((p) => p.title)).not.toContain("Evidence index");
    expect(
      journey.pages.filter((p) => p.parentId === null).map((p) => p.title),
    ).toEqual([
      "Start here",
      "My plan",
      "HiLLOs",
      "Evidence",
      "Supervision meetings",
      "Placements",
      "Reflections",
      "Application narrative",
      "Resources",
    ]);
  });

  it("builds to format 4 with exactly 118 pages: 92 KCs under 14 HiLLOs, plus 12 others", () => {
    expect(snapshot.format).toBe(4);
    expect(snapshot.notes).toEqual([]);
    expect(snapshot.relations).toEqual([]);
    // Spec §3 says 117, but its own tree lists 12 pages besides the HiLLOs
    // and KCs (Start here, My plan, HiLLOs, Evidence, Evidence rules,
    // Supervision meetings, Placements, PICU, Neuro ICU, Reflections,
    // Application narrative, Resources): 92 + 14 + 12 = 118.
    expect(snapshot.pages).toHaveLength(118);
    expect(
      snapshot.pages.filter(
        (p) => !p.title.startsWith("KC ") && !p.title.startsWith("HiLLO "),
      ),
    ).toHaveLength(12);
    const hillos = snapshot.pages.filter(
      (p) => titleOf(p.parent_key) === "HiLLOs",
    );
    expect(hillos.map((p) => p.title)).toEqual(CESR_CURRICULUM.map(hilloTitle));
    const kcs = snapshot.pages.filter((p) => p.title.startsWith("KC "));
    expect(kcs).toHaveLength(92);
    for (const kc of kcs) {
      expect(hillos.map((h) => h.key)).toContain(kc.parent_key);
      expect(kc.properties?.rows.map((r) => r.id)).toEqual([
        ...KC_PROPERTY_IDS,
      ]);
      expect(kc.properties?.rows[0]).toMatchObject({ value: "Not started" });
    }
    for (const hillo of hillos) {
      const children = kcs.filter((kc) => kc.parent_key === hillo.key);
      const data = CESR_CURRICULUM.find((h) => hilloTitle(h) === hillo.title)!;
      expect(children.map((c) => c.title.split(" — ")[0])).toEqual(
        data.kcs.map((kc) => `KC ${kc.id}`),
      );
    }
    expect(
      titleOf(
        byKey.get(
          snapshot.pages.find(
            (p) => p.title === "Evidence rules that apply everywhere",
          )!.parent_key!,
        )?.key ?? null,
      ),
    ).toBe("Evidence");
  });

  it("has 14 supervisor summary synced sources on the HiLLO pages, placed read-only on the hub", () => {
    expect(snapshot.synced?.map((s) => s.key)).toEqual(
      CESR_CURRICULUM.map((h) => summaryKey(h.n)),
    );
    for (const entry of snapshot.synced ?? []) {
      expect(titleOf(entry.source_key)).toMatch(/^HiLLO \d+ — /);
    }
    expect(JSON.stringify(snapshot)).not.toContain("-progress");
    const hub = snapshot.pages.find((p) => p.title === "HiLLOs")!;
    const placements = hub.blocks.filter((b) => b.type === "syncedBlock");
    expect(placements).toHaveLength(14);
    for (const placement of placements) {
      expect(placement.content?.props).toMatchObject({ readOnly: true });
    }
  });

  it("carries no placeholder for curriculum wording", () => {
    for (const page of snapshot.pages) {
      if (page.title.startsWith("KC ") || page.title.startsWith("HiLLO ")) {
        expect(page.description).not.toContain("«");
        const quote = page.blocks.find((b) => b.type === "quote")!;
        expect(JSON.stringify(quote)).not.toContain("«");
        expect(page.description?.length).toBeGreaterThan(0);
      }
    }
    expect(JSON.stringify(snapshot)).not.toMatch(
      /paste (from|the) (FICM|key capability)/i,
    );
  });

  it("puts the summary blocks in the Mid, End and Pre-submission meetings only, read-write", () => {
    for (const template of supportingTemplates()) {
      const built = packToSnapshot(template);
      const placements = built.snapshot.pages[0].blocks.filter(
        (b) => b.type === "syncedBlock",
      );
      const embeds = /Mid-placement|End-of-placement|Pre-submission/.test(
        template.name,
      );
      expect(placements).toHaveLength(embeds ? 14 : 0);
      if (embeds) {
        expect(template.synced?.every((s) => s.sourcePageId === null)).toBe(
          true,
        );
        expect(built.snapshot.synced?.map((s) => s.key)).toEqual(
          CESR_CURRICULUM.map((h) => summaryKey(h.n)),
        );
        for (const placement of placements) {
          expect(placement.content?.props).toMatchObject({ readOnly: false });
        }
        expect(template.changelog).toMatch(/summary blocks/);
      }
    }
  });
});
