import { describe, expect, it } from "vitest";
import type { EditorBlock } from "../src/lib/blocks";
import {
  anaesthesiaRotationTree,
  BUNDLE_TITLE,
  MILESTONE_PROPERTY_IDS,
  PHASE_TITLES,
  phaseOf,
  ROTATION_TITLE,
  STRAND_ICONS,
  type RotationIds,
} from "./cesr-anaesthesia-pages";
import {
  ANAESTHESIA_MILESTONES,
  MILESTONE_PHASES,
  MILESTONE_STRANDS,
  type MilestoneEvidence,
} from "./cesr-anaesthesia-rotation";
import { CESR_CURRICULUM } from "./cesr-curriculum";
import { hilloTitle, STATUS_VALUES } from "./cesr-hillo-pages";
import { cesrJourney } from "./cesr-journey";
import { packToSnapshot } from "../scripts/pack-snapshot";

const EVIDENCE_VALUES: MilestoneEvidence[] = [
  "Logbook",
  "Logbook + DOPS",
  "Logbook + CBD or reflection",
  "SLE form",
  "Certificate",
  "Attendance record",
  "Rota evidence",
  "Reading log + reflection",
];

/** Deterministic UUID-shaped ids. */
function ids() {
  let n = 0;
  return () =>
    `${(++n).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

const textOf = (block: EditorBlock) =>
  Array.isArray(block.content)
    ? (block.content as { text: string }[]).map((r) => r.text).join("")
    : "";

function build() {
  const next = ids();
  const rotationIds: RotationIds = {
    rotation: next(),
    before: next(),
    after: next(),
    bundle: next(),
    milestones: Object.fromEntries(
      ANAESTHESIA_MILESTONES.map((m) => [m.id, next()]),
    ),
    placements: next(),
    hillo10: next(),
    evidenceRules: next(),
    meetings: next(),
  };
  const hillo10 = CESR_CURRICULUM.find((h) => h.n === 10)!;
  const kcPageIds = Object.fromEntries(
    hillo10.kcs.map((kc) => [kc.id, next()]),
  );
  return {
    rotationIds,
    kcPageIds,
    tree: anaesthesiaRotationTree(rotationIds, kcPageIds),
  };
}

describe("anaesthesiaRotationTree", () => {
  const { rotationIds, kcPageIds, tree } = build();
  const byTitle = new Map(tree.pages.map((p) => [p.title, p]));

  it("has 64 pages: overview, two phases, the bundle and 60 milestones", () => {
    expect(tree.pages).toHaveLength(64);
    expect(tree.pages.slice(0, 4).map((p) => p.title)).toEqual([
      ROTATION_TITLE,
      PHASE_TITLES["Before the IAC"],
      PHASE_TITLES["After the IAC"],
      BUNDLE_TITLE,
    ]);
    expect(byTitle.get(ROTATION_TITLE)!.parentId).toBe(rotationIds.placements);
    expect(byTitle.get(ROTATION_TITLE)!.icon).toBe("🩺");
    for (const title of [
      PHASE_TITLES["Before the IAC"],
      PHASE_TITLES["After the IAC"],
      BUNDLE_TITLE,
    ]) {
      expect(byTitle.get(title)!.parentId).toBe(rotationIds.rotation);
    }
    expect(new Set(tree.pages.map((p) => p.id)).size).toBe(64);
  });

  it("gives every milestone the six properties in order, Status first and seeded like a KC", () => {
    for (const m of ANAESTHESIA_MILESTONES) {
      const page = byTitle.get(m.title)!;
      expect(page, m.id).toBeDefined();
      expect(page.id).toBe(rotationIds.milestones[m.id]);
      expect(page.icon).toBe(STRAND_ICONS[m.strand]);
      expect(page.description).toBe(`Evidence expected: ${m.evidence}`);
      expect(page.properties?.map((r) => r.id)).toEqual([
        ...MILESTONE_PROPERTY_IDS,
      ]);
      expect(page.properties?.map((r) => r.type)).toEqual([
        "select",
        "select",
        "select",
        "select",
        "relation",
        "relation",
      ]);
      // Status first: the sub-page list shows a child's first select.
      expect(page.properties?.[0]).toMatchObject({
        label: "Status",
        value: STATUS_VALUES[0],
      });
      expect(page.properties?.[1]).toMatchObject({
        label: "Phase",
        value: m.phase,
      });
      expect(page.properties?.[2]).toMatchObject({
        label: "Strand",
        value: m.strand,
      });
      expect(page.properties?.[3]).toMatchObject({
        label: "Evidence expected",
        value: m.evidence,
      });
      expect(page.properties?.[4]).toMatchObject({
        label: "Evidence",
        reverse_label: "Rotation evidence for",
      });
      expect(page.properties?.[5]).toMatchObject({
        label: "Serves",
        reverse_label: "Rotation milestones",
      });
      // No Signed off, Supervisor, or trainee field as a property.
      expect(page.properties?.some((r) => r.type === "date")).toBe(false);
      expect(page.properties?.some((r) => r.type === "people")).toBe(false);
    }
  });

  it("uses no select value outside the four fixed vocabularies", () => {
    const allowed = new Set<string>([
      ...STATUS_VALUES,
      ...MILESTONE_PHASES,
      ...MILESTONE_STRANDS,
      ...EVIDENCE_VALUES,
    ]);
    for (const page of tree.pages) {
      for (const row of page.properties ?? []) {
        if (row.type === "select") expect(allowed).toContain(row.value);
      }
    }
    // The pack's Status vocabulary, and nothing like "Done" or "Alternative".
    const text = JSON.stringify(tree.pages);
    expect(text).not.toMatch(/Alternative evidence/);
    expect(text).not.toMatch(/"value":"Done"/);
  });

  it("puts each milestone under its phase page, Both under Before the IAC", () => {
    for (const m of ANAESTHESIA_MILESTONES) {
      const page = byTitle.get(m.title)!;
      const expected =
        phaseOf(m) === "Before the IAC"
          ? rotationIds.before
          : rotationIds.after;
      expect(page.parentId, m.id).toBe(expected);
      if (m.phase === "Both") expect(page.parentId).toBe(rotationIds.before);
      const back = page.blocks.flat().at(-1)!;
      expect(back.type).toBe("pageLink");
      expect(back.props).toMatchObject({ pageId: expected });
    }
  });

  it("lays a milestone page out as how-to, optional note, Notes, divider, back link", () => {
    const withNote = ANAESTHESIA_MILESTONES.find((m) => m.note)!;
    const without = ANAESTHESIA_MILESTONES.find((m) => !m.note)!;
    const a = byTitle.get(withNote.title)!.blocks.flat();
    expect(a.map((b) => b.type)).toEqual([
      "callout",
      "quote",
      "heading",
      "paragraph",
      "divider",
      "pageLink",
    ]);
    expect(textOf(a[1])).toBe(withNote.note);
    const howTo = textOf(a[0]);
    for (const value of STATUS_VALUES) expect(howTo).toContain(value);
    expect(howTo).toContain("Serves lists the KC pages");
    expect(textOf(a[3])).toContain("«");
    const b = byTitle.get(without.title)!.blocks.flat();
    expect(b.map((x) => x.type)).toEqual([
      "callout",
      "heading",
      "paragraph",
      "divider",
      "pageLink",
    ]);
  });

  it("links every milestone from its phase page's strand list, Both ones twice", () => {
    const linksOf = (title: string) =>
      byTitle
        .get(title)!
        .blocks.flat()
        .filter((b) => b.type === "pageLink")
        .map((b) => b.props as { pageId: string; title: string });
    const before = linksOf(PHASE_TITLES["Before the IAC"]);
    const after = linksOf(PHASE_TITLES["After the IAC"]);
    for (const m of ANAESTHESIA_MILESTONES) {
      const id = rotationIds.milestones[m.id];
      const inBefore = before.filter((l) => l.pageId === id);
      const inAfter = after.filter((l) => l.pageId === id);
      if (m.phase === "Before the IAC") {
        expect(inBefore).toHaveLength(1);
        expect(inAfter).toHaveLength(0);
      } else if (m.phase === "After the IAC") {
        expect(inBefore).toHaveLength(0);
        expect(inAfter).toHaveLength(1);
      } else {
        expect(inBefore).toHaveLength(1);
        expect(inAfter).toHaveLength(1);
        expect(inAfter[0].title).toBe(`${m.title} (continues)`);
      }
    }
    // Five strand headings each, Rota empty before the IAC with a line saying so.
    const h3s = (title: string) =>
      byTitle
        .get(title)!
        .blocks.flat()
        .filter((b) => b.type === "heading" && b.props?.level === 3)
        .map(textOf);
    expect(h3s(PHASE_TITLES["Before the IAC"])).toEqual([...MILESTONE_STRANDS]);
    expect(h3s(PHASE_TITLES["After the IAC"])).toEqual([...MILESTONE_STRANDS]);
    expect(
      JSON.stringify(byTitle.get(PHASE_TITLES["Before the IAC"])!.blocks),
    ).toContain("No rota milestones before the IAC");
  });

  it("gives the phase pages their logbook tables and the IAC / supervisor report to-dos", () => {
    const before = byTitle.get(PHASE_TITLES["Before the IAC"])!.blocks.flat();
    const after = byTitle.get(PHASE_TITLES["After the IAC"])!.blocks.flat();
    const rows = (blocks: EditorBlock[]) =>
      (
        blocks.find((b) => b.type === "table")!.content as {
          rows: { cells: { text: string }[][] }[];
        }
      ).rows;
    expect(rows(before).map((r) => r.cells[0][0].text)).toEqual([
      "Category",
      "Total",
      "Elective ASA 1–2",
      "Emergency",
      "Supraglottic airway",
      "Tracheal intubation",
    ]);
    expect(rows(after).map((r) => r.cells[0][0].text)).toEqual([
      "Category",
      "Total",
      "Elective ASA 1–3",
      "Emergency ASA 1E–3E",
      "Out of hours",
      "Obstetric",
      "Trauma",
      "Regional",
      "Neuraxial",
    ]);
    for (const table of [rows(before), rows(after)]) {
      for (const row of table.slice(1)) {
        for (const cell of row.cells.slice(1)) {
          expect(cell[0].text).toMatch(/^«.*»$/);
        }
      }
    }
    const h2s = (blocks: EditorBlock[]) =>
      blocks
        .filter((b) => b.type === "heading" && b.props?.level === 2)
        .map(textOf);
    expect(h2s(before)).toEqual([
      "Strands",
      "Logbook summary at last review",
      "The IAC",
    ]);
    expect(h2s(after)).toEqual([
      "Strands",
      "Logbook summary at last review",
      "Supervisor reports",
    ]);
    expect(before.filter((b) => b.type === "checkListItem")).toHaveLength(2);
    expect(after.filter((b) => b.type === "checkListItem")).toHaveLength(2);
  });

  it("seeds one Serves relation per (milestone, KC), in data order, to KC 10.x pages", () => {
    const expected = ANAESTHESIA_MILESTONES.flatMap((m) =>
      m.serves.map((kc) => ({
        sourcePageId: rotationIds.milestones[m.id],
        propertyId: "serves",
        targetPageId: kcPageIds[kc],
      })),
    );
    expect(tree.relations).toEqual(expected);
    expect(tree.relations).toHaveLength(
      ANAESTHESIA_MILESTONES.reduce((n, m) => n + m.serves.length, 0),
    );
    const kcPages = new Set(Object.values(kcPageIds));
    for (const link of tree.relations)
      expect(kcPages).toContain(link.targetPageId);
  });

  it("refuses a milestone that serves a KC with no page, or has no page id", () => {
    const { rotationIds: r, kcPageIds: k } = build();
    const { "10.10": _dropped, ...fewer } = k;
    void _dropped;
    expect(() => anaesthesiaRotationTree(r, fewer)).toThrow(/serves KC 10.10/);
    const { "log-total": _gone, ...fewerIds } = r.milestones;
    void _gone;
    expect(() =>
      anaesthesiaRotationTree({ ...r, milestones: fewerIds }, k),
    ).toThrow(/no page id for milestone log-total/);
  });

  it("writes the overview and bundle with the fixed status vocabulary and no numeric targets", () => {
    const overview = byTitle.get(ROTATION_TITLE)!.blocks.flat();
    const h2s = overview
      .filter((b) => b.type === "heading" && b.props?.level === 2)
      .map(textOf);
    expect(h2s).toEqual([
      "How the year runs",
      "If you already hold an IAC",
      "Your logbook",
      "Milestone status",
    ]);
    const text = JSON.stringify(byTitle.get(ROTATION_TITLE)!.blocks);
    expect(text).toContain("Diary.ICU");
    for (const value of STATUS_VALUES) expect(text).toContain(value);
    const links = overview
      .filter((b) => b.type === "pageLink")
      .map((b) => (b.props as { title: string }).title);
    expect(links).toEqual([
      "Before the IAC",
      "After the IAC",
      "HiLLO 10 bundle",
      "HiLLO 10 — Anaesthesia",
      "Evidence rules that apply everywhere",
    ]);
    const bundle = byTitle.get(BUNDLE_TITLE)!.blocks.flat();
    expect(bundle.filter((b) => b.type === "checkListItem")).toHaveLength(8);
    for (const page of tree.pages) {
      const all = JSON.stringify(page.blocks);
      expect(all).not.toMatch(/\b\d+\s*\+/);
      expect(all).not.toMatch(/\b(80|100)\s*%/);
      expect(all).not.toMatch(/GMC number|date of birth/i);
    }
  });
});

describe("the rotation inside the CESR Journey pack", () => {
  const journey = cesrJourney();
  const byTitle = new Map(journey.pages.map((p) => [p.title, p]));
  const built = packToSnapshot(journey);

  it("sits under Placements, linked first from the hub, with 64 new pages", () => {
    const placements = byTitle.get("Placements")!;
    const links = placements.blocks
      .flat()
      .filter((b) => b.type === "pageLink")
      .map((b) => b.props as { pageId: string; title: string });
    expect(links[0].title).toBe(ROTATION_TITLE);
    expect(links[0].pageId).toBe(byTitle.get(ROTATION_TITLE)!.id);
    expect(byTitle.get(ROTATION_TITLE)!.parentId).toBe(placements.id);
    expect(JSON.stringify(placements.blocks)).toContain(
      "worked example of a placement tree",
    );
    const under = (id: string): number =>
      journey.pages
        .filter((p) => p.parentId === id)
        .reduce((n, p) => n + 1 + under(p.id), 0);
    expect(under(byTitle.get(ROTATION_TITLE)!.id) + 1).toBe(64);
  });

  it("links HiLLO 10 to the rotation directly after Required evidence, and no other HiLLO", () => {
    for (const hillo of CESR_CURRICULUM) {
      const page = byTitle.get(hilloTitle(hillo))!;
      const blocks = page.blocks.flat();
      const link = blocks.findIndex(
        (b) =>
          b.type === "pageLink" &&
          (b.props as { title: string }).title === ROTATION_TITLE,
      );
      if (hillo.n !== 10) {
        expect(link, hilloTitle(hillo)).toBe(-1);
        continue;
      }
      expect(link).toBeGreaterThan(0);
      expect(blocks[link - 1].type).toBe("paragraph");
      expect(textOf(blocks[link - 1])).toContain(
        "plans this year phase by phase",
      );
      const required = blocks[link - 2];
      expect(required.type).toBe("callout");
      expect(required.props).toMatchObject({ colour: "red" });
      expect(blocks[link + 1].type).toBe("heading");
      expect(textOf(blocks[link + 1])).toBe("Maintenance route (>7 years)");
      expect((blocks[link].props as { pageId: string }).pageId).toBe(
        byTitle.get(ROTATION_TITLE)!.id,
      );
    }
  });

  it("adds the rotation sentence to the HiLLO 10 KC how-tos only, leaving the menus alone", () => {
    const sentence =
      "Rotation milestones (below the properties) are the plan for this KC; Evidence is still what proves it.";
    for (const page of journey.pages) {
      if (!page.title.startsWith("KC ")) continue;
      const howTo = textOf(page.blocks.flat()[0]);
      expect(howTo.includes(sentence)).toBe(page.title.startsWith("KC 10."));
      expect(page.properties?.map((r) => r.id)).toEqual([
        "status",
        "signed_off",
        "supervisor",
        "evidence",
      ]);
    }
  });

  it("builds every Serves link to a KC 10.x key with no notes", () => {
    expect(built.snapshot.notes).toEqual([]);
    const keyToTitle = new Map(
      built.snapshot.pages.map((p) => [p.key, p.title]),
    );
    expect(built.snapshot.relations).toHaveLength(
      ANAESTHESIA_MILESTONES.reduce((n, m) => n + m.serves.length, 0),
    );
    for (const link of built.snapshot.relations ?? []) {
      expect(link.property_id).toBe("serves");
      expect(keyToTitle.get(link.target_key)).toMatch(/^KC 10\.\d+ — /);
      expect(keyToTitle.has(link.source_key)).toBe(true);
    }
  });
});
