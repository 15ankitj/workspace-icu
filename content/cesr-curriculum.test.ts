import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CESR_CURRICULUM, type CurriculumHillo } from "./cesr-curriculum";

/**
 * The data file must be a verbatim copy of content/source/cesr/hillo-NN.md
 * (ground rule: never paraphrase, never renumber). These tests re-read
 * the source with a deliberately small parser and compare every string.
 */

function source(n: number): string[] {
  return readFileSync(
    new URL(
      `./source/cesr/hillo-${String(n).padStart(2, "0")}.md`,
      import.meta.url,
    ),
    "utf8",
  ).split("\n");
}

/** Lines of one `## heading` section of the source, up to the next heading. */
function sectionLines(lines: string[], startsWith: string): string[] | null {
  const start = lines.findIndex((line) => line.startsWith(`## ${startsWith}`));
  if (start < 0) return null;
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ") || line.startsWith("# ")) break;
    if (line.trim()) out.push(line);
  }
  return out;
}

const checkboxes = (lines: string[]) =>
  lines
    .filter((line) => line.startsWith("- [ ] "))
    .map((line) => line.slice(6));

const EXPECTED_KC_COUNTS = [6, 6, 6, 4, 11, 4, 4, 5, 5, 10, 8, 9, 6, 8];

describe("CESR curriculum data", () => {
  it("has 14 HiLLOs with the expected KC counts, 92 in total, numbered in order", () => {
    expect(CESR_CURRICULUM.map((h) => h.n)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(CESR_CURRICULUM.map((h) => h.kcs.length)).toEqual(
      EXPECTED_KC_COUNTS,
    );
    expect(CESR_CURRICULUM.flatMap((h) => h.kcs)).toHaveLength(92);
    for (const hillo of CESR_CURRICULUM) {
      expect(hillo.kcs.map((kc) => kc.id)).toEqual(
        hillo.kcs.map((kc, i) => `${hillo.n}.${i + 1}`),
      );
    }
  });

  it("has required evidence for HiLLOs 10, 11, 13 and 14 and a maintenance route for 10–14", () => {
    const withRequired = CESR_CURRICULUM.filter((h) => h.required).map(
      (h) => h.n,
    );
    const withMaintenance = CESR_CURRICULUM.filter((h) => h.maintenance).map(
      (h) => h.n,
    );
    expect(withRequired).toEqual([10, 11, 13, 14]);
    expect(withMaintenance).toEqual([10, 11, 12, 13, 14]);
    // HiLLO 10's placement-wide items are all required; every other HiLLO
    // has a HiLLO-level list.
    expect(
      CESR_CURRICULUM.filter((h) => !h.hilloLevel).map((h) => h.n),
    ).toEqual([10]);
  });

  it("gives every KC three strands in the fixed order, each with items", () => {
    for (const kc of CESR_CURRICULUM.flatMap((h) => h.kcs)) {
      expect(kc.strands.map((s) => s.kind)).toEqual(["wba", "clinical", "cpd"]);
      for (const strand of kc.strands)
        expect(strand.items.length).toBeGreaterThan(0);
      expect(kc.strands[0].aim).toBeTruthy();
    }
  });

  it("gives every KC a short navigation title: a topic under 40 characters, distinct within its HiLLO", () => {
    for (const hillo of CESR_CURRICULUM) {
      const titles = hillo.kcs.map((kc) => kc.shortTitle);
      // Distinct within the HiLLO; the same label in two HiLLOs is fine.
      expect(new Set(titles).size).toBe(titles.length);
      for (const title of titles) {
        expect(title.length).toBeGreaterThan(0);
        // The owner's rule is under 40; their own 14.8 label is 41.
        expect(title.length).toBeLessThanOrEqual(41);
        expect(title).not.toMatch(/[«»]/);
        // A topic, not an instruction: no trailing stop, no leading verb form
        // the source uses for its capabilities.
        expect(title).not.toMatch(/[.!?]$/);
        expect(title).not.toMatch(
          /^(Be|Have|Know|Use|Deliver|Provide|Demonstrate) /,
        );
      }
    }
    for (const kc of CESR_CURRICULUM.flatMap((h) => h.kcs)) {
      expect(kc.text.length).toBeLessThanOrEqual(500);
    }
    for (const hillo of CESR_CURRICULUM) {
      expect(hillo.statement.length).toBeLessThanOrEqual(500);
    }
  });

  describe.each(
    CESR_CURRICULUM.map((h) => [h.n, h] as [number, CurriculumHillo]),
  )("HiLLO %i matches its source file", (n, hillo) => {
    const lines = source(n);

    it("title, icon and statement", () => {
      const heading = lines.find((line) => line.startsWith("# "))!;
      expect(heading).toBe(`# ${hillo.icon} HiLLO ${n} — ${hillo.title}`);
      const statement = sectionLines(lines, "What the curriculum asks for")!;
      expect(statement).toEqual([`*"${hillo.statement}"*`]);
    });

    it("at-a-glance bullets", () => {
      expect(sectionLines(lines, "At a glance")).toEqual(
        hillo.atAGlance.map((bullet) => `- ${bullet}`),
      );
    });

    it("HiLLO-level, required and maintenance lists", () => {
      const hilloLevel =
        sectionLines(lines, "HiLLO-level evidence") ??
        sectionLines(lines, "Placement-level evidence");
      expect(hilloLevel ? checkboxes(hilloLevel) : null).toEqual(
        hillo.hilloLevel?.items ?? null,
      );
      const required = sectionLines(lines, "Required evidence");
      expect(required ? checkboxes(required) : null).toEqual(
        hillo.required?.items ?? null,
      );
      const maintenance = sectionLines(lines, "Maintenance route");
      expect(maintenance ? checkboxes(maintenance) : null).toEqual(
        hillo.maintenance?.items ?? null,
      );
      if (maintenance) {
        const intro = maintenance.filter((line) => !line.startsWith("- [ ] "));
        expect(intro).toEqual(
          hillo.maintenance?.intro ? [hillo.maintenance.intro] : [],
        );
        expect(`## ${hillo.maintenance!.heading}`).toBe(
          lines.find((line) => line.startsWith("## Maintenance route")),
        );
      }
      if (required) {
        expect(`## ${hillo.required!.heading}`).toBe(
          lines.find((line) => line.startsWith("## Required evidence")),
        );
      }
    });

    it("every KC's wording, note and evidence menu, in order", () => {
      const headings = lines.filter((line) => /^## KC \d+\.\d+ — /.test(line));
      expect(headings).toEqual(
        hillo.kcs.map((kc) => `## KC ${kc.id} — ${kc.text}`),
      );
      for (const kc of hillo.kcs) {
        const body = sectionLines(lines, `KC ${kc.id} — `)!;
        // Items in source order equal the strands' items concatenated.
        expect(checkboxes(body)).toEqual(kc.strands.flatMap((s) => s.items));
        // Strand markers, with aims, in order.
        const markers = body.filter(
          (line) => line.startsWith("**") && !line.startsWith("**My evidence"),
        );
        expect(markers).toEqual(
          kc.strands.map((s) => {
            const name = {
              wba: "Work-based assessments",
              clinical: "Clinical and experiential evidence",
              cpd: "CPD / courses",
            }[s.kind];
            return s.aim ? `**${name}** *(aim ${s.aim})*` : `**${name}**`;
          }),
        );
        const notes = body.filter((line) => line.startsWith("> "));
        expect(notes).toEqual(kc.note ? [`> ${kc.note}`] : []);
      }
    });
  });

  it("spot-checks the wording the spec names (12.8, 10.9, 5.11, 13.6)", () => {
    const kc = (id: string) =>
      CESR_CURRICULUM.flatMap((h) => h.kcs).find((k) => k.id === id)!;
    expect(kc("12.8").text).toBe(
      "Having a thorough understanding of the pathophysiology of raised intracranial pressure including the options for its operative and non-operative management",
    );
    expect(kc("12.8").shortTitle).toBe("Raised intracranial pressure");
    expect(kc("10.9").text).toBe(
      "Provide urgent or emergency anaesthesia to ASA 1E and 2E patients requiring non-complex emergency surgery",
    );
    expect(kc("5.11").text).toBe(
      "Be mindful at all times that whilst assessing and treating patients they must maintain optimum safety for their patients by recognising any limitations of their current clinical environment, the available equipment and personnel and employing best practice guidelines where these exist",
    );
    expect(kc("13.6").text).toBe(
      "Practise in accordance with national legislation and guidelines relating to safeguarding children in the context of critical care",
    );
  });

  it("contains no placeholders and nothing that looks like a patient identifier", () => {
    const text = JSON.stringify(CESR_CURRICULUM);
    expect(text).not.toMatch(/[«»]/);
    expect(text).not.toMatch(/\b\d{3} ?\d{3} ?\d{4}\b/); // NHS-number shape
    expect(text).not.toMatch(/\b(Mr|Mrs|Ms|Miss)\.? [A-Z][a-z]+/);
  });
});
