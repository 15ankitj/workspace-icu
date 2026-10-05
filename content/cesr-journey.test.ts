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

  it("is version 7 (Anaesthesia rotation) with no Evidence index", () => {
    expect(journey.version).toBe(7);
    expect(journey.changelog).toBe(
      "Anaesthesia rotation under Placements: before- and after-IAC milestone pages for HiLLO 10, each linked to the KC pages it serves (the KC 10.x pages now list their rotation milestones), plus a HiLLO 10 bundle checklist. Existing workspaces receive the new pages; KC pages they have not edited gain the link.",
    );
    expect(journey.pages.map((p) => p.title)).not.toContain("Evidence index");
    expect(
      journey.pages.filter((p) => p.parentId === null).map((p) => p.title),
    ).toEqual([
      "Start here",
      "Portfolio self-assessment",
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

  it("tells candidates where the Private option lives, and who may use it", () => {
    const start = snapshot.pages.find((p) => p.title === "Start here")!;
    const text = textOf(start.blocks);
    expect(text).toContain(
      "Mark a page Private from the ⋯ menu at the top of the page, or from its row in the sidebar",
    );
    expect(text).toContain(
      "Only the person who created a page can make it private.",
    );
    expect(text).not.toContain("Private (page menu)");
  });

  it("builds to format 4 with exactly 183 pages: 92 KCs under 14 HiLLOs, plus 13 others and the 64-page rotation", () => {
    expect(snapshot.format).toBe(4);
    expect(snapshot.notes).toEqual([]);
    // v7: the rotation's Serves links, every one inside the template.
    const keys = new Set(snapshot.pages.map((p) => p.key));
    expect(snapshot.relations?.length).toBeGreaterThan(0);
    for (const link of snapshot.relations ?? []) {
      expect(keys.has(link.source_key)).toBe(true);
      expect(keys.has(link.target_key)).toBe(true);
    }
    // Spec §3 says 117, but its own tree lists 12 pages besides the HiLLOs
    // and KCs (Start here, My plan, HiLLOs, Evidence, Evidence rules,
    // Supervision meetings, Placements, PICU, Neuro ICU, Reflections,
    // Application narrative, Resources); v6 adds Portfolio
    // self-assessment: 92 + 14 + 13 = 119; v7 adds the 64-page
    // Anaesthesia rotation under Placements: 183.
    expect(snapshot.pages).toHaveLength(183);
    // "HiLLO 10 bundle" is a rotation page, not a HiLLO page.
    const curriculumPage = /^(KC \d+\.\d+|HiLLO \d+) — /;
    expect(
      snapshot.pages.filter((p) => !curriculumPage.test(p.title)),
    ).toHaveLength(13 + 64);
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

  it("lays out the Portfolio self-assessment page in the v6 order, all placeholders, no identifiers", () => {
    const page = snapshot.pages.find(
      (p) => p.title === "Portfolio self-assessment",
    )!;
    expect(page.parent_key).toBeNull();
    expect(page.icon).toBe("🧭");
    expect(page.authored_content ?? false).toBe(false);
    const blocks = page.blocks;
    const text = (block: (typeof blocks)[number]) =>
      Array.isArray(block.content?.content)
        ? (block.content.content as { text: string }[])
            .map((r) => r.text)
            .join("")
        : "";
    const headings = blocks
      .filter((b) => b.type === "heading")
      .map((b) => [b.content?.props?.level, text(b)]);
    expect(headings).toEqual([
      [2, "About you"],
      [2, "Placements"],
      [2, "Examinations and qualifications"],
      [3, "Specialist ICM examination"],
      [3, "Other examinations and degrees"],
      [2, "Structured learning events"],
      [2, "Cross-cutting evidence"],
      [3, "Quality improvement"],
      [3, "Teaching and training"],
      [3, "Research and evidence"],
      [3, "Leadership and management"],
      [3, "Courses and CPD"],
      [2, "Supporting documents"],
      [2, "Gap analysis"],
      [3, "Supervisor's view"],
      [3, "Agreed priority actions"],
    ]);
    // How-to then no-PHI callouts first.
    expect(blocks[0].type).toBe("callout");
    expect(text(blocks[0])).toContain(
      "complete this once with your supervisor",
    );
    expect(blocks[1].type).toBe("callout");
    expect(text(blocks[1])).toContain(
      "Never add patient-identifiable information",
    );
    // Three tables: About you (7 rows), Placements (header + 6), SLEs (header + 6).
    const tables = blocks.filter((b) => b.type === "table");
    const rows = (block: (typeof blocks)[number]) =>
      (
        block.content?.content as {
          rows: { cells: { text: string }[][] }[];
        }
      ).rows;
    expect(tables).toHaveLength(3);
    expect(rows(tables[0])).toHaveLength(7);
    expect(rows(tables[0])[0].cells.map((c) => c[0].text)).toEqual([
      "Item",
      "Your answer",
    ]);
    expect(rows(tables[1])[0].cells.map((c) => c[0].text)).toEqual([
      "Placement",
      "Where",
      "Duration (months, WTE)",
      "Dates",
      "Within the last 7 years?",
      "Self-rated level (1–4)",
      "Evidence held",
    ]);
    expect(
      rows(tables[1])
        .slice(1)
        .map((r) => r.cells[0][0].text),
    ).toEqual([
      "General ICM (minimum 2¼ years)",
      "Anaesthesia",
      "Medicine",
      "Neurosciences ICM",
      "Cardiothoracic ICM",
      "Paediatric ICM",
    ]);
    expect(rows(tables[2])[0].cells.map((c) => c[0].text)).toEqual([
      "Type",
      "Count",
      "Of which HiLLO 10 (anaesthesia)",
      "Notes",
    ]);
    expect(
      rows(tables[2])
        .slice(1)
        .map((r) => r.cells[0][0].text),
    ).toEqual(["Mini-CEX", "CBD", "DOPS", "ACAT", "MSF", "Total"]);
    // Every cell the candidate fills is a «placeholder».
    for (const table of tables) {
      for (const row of rows(table).slice(1)) {
        for (const cell of row.cells.slice(1)) {
          expect(cell[0].text).toMatch(/^«.*»$/);
        }
      }
    }
    // Ends with the divider and the three page links, in order.
    const tail = blocks.slice(-4);
    expect(tail.map((b) => b.type)).toEqual([
      "divider",
      "pageLink",
      "pageLink",
      "pageLink",
    ]);
    expect(tail.slice(1).map((b) => b.content?.props?.title)).toEqual([
      "Evidence rules that apply everywhere",
      "My plan",
      "HiLLOs",
    ]);
    const whole = textOf(blocks);
    expect(whole).toContain("Special Skills Year: ");
    expect(whole).toContain("Copy the agreed actions into My plan");
    expect(whole).not.toMatch(/GMC number/i);
    expect(whole).not.toMatch(/date of birth/i);
  });

  it("links the self-assessment from Start here and from My plan's milestones, and never mentions a GMC number", () => {
    const start = snapshot.pages.find((p) => p.title === "Start here")!;
    const links = start.blocks
      .filter((b) => b.type === "pageLink")
      .map((b) => b.content?.props?.title);
    expect(links[0]).toBe("Portfolio self-assessment");
    expect(textOf(start.blocks)).toContain(
      "At the start: complete the Portfolio self-assessment with your supervisor, then copy its gap analysis into My plan",
    );
    const plan = snapshot.pages.find((p) => p.title === "My plan")!;
    const milestones = plan.blocks.findIndex(
      (b) =>
        b.type === "checkListItem" &&
        JSON.stringify(b).includes(
          "Complete a baseline self-assessment against all 14 HiLLOs",
        ),
    );
    const afterMilestones = plan.blocks.findIndex(
      (b, index) => index > milestones && b.type !== "checkListItem",
    );
    expect(plan.blocks[afterMilestones].type).toBe("pageLink");
    expect(plan.blocks[afterMilestones].content?.props).toMatchObject({
      title: "Portfolio self-assessment",
    });
    // No page asks for a GMC number. The one mention in the pack is the
    // verbatim anonymisation rule on the Evidence rules page ("GMC numbers
    // of colleagues … "), which tells candidates to remove them.
    for (const page of snapshot.pages) {
      const mentions = textOf(page.blocks).match(/GMC number[^"]*/gi) ?? [];
      if (page.title === "Evidence rules that apply everywhere") {
        expect(mentions).toEqual([
          "GMC numbers of colleagues you have assessed, referenced, or complained about",
        ]);
      } else {
        expect(mentions).toEqual([]);
      }
    }
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
      if (/^(KC \d+\.\d+|HiLLO \d+) — /.test(page.title)) {
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
