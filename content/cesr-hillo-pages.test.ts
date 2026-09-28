import { describe, expect, it } from "vitest";
import type { EditorBlock } from "../src/lib/blocks";
import { md, synced } from "./blocks";
import { CESR_CURRICULUM } from "./cesr-curriculum";
import {
  hilloTitle,
  hilloTree,
  KC_PROPERTY_IDS,
  kcPage,
  kcTitle,
  STATUS_VALUES,
  summaryKey,
  supervisorSummaryBlocks,
} from "./cesr-hillo-pages";
import type { PackPage, PackTemplate } from "./cesr-journey";
import { packToSnapshot } from "../scripts/pack-snapshot";

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

/** All 14 trees under one hub, as the workspace template will hold them. */
function allTrees(): { hub: string; pages: PackPage[]; summaries: string[] } {
  const next = ids();
  const hub = next();
  const summaries: string[] = [];
  const pages = CESR_CURRICULUM.flatMap((hillo) => {
    const summaryId = next();
    summaries.push(summaryId);
    return hilloTree(
      hillo,
      { page: next(), hub, kcPages: hillo.kcs.map(() => next()) },
      synced(summaryId),
    );
  });
  return { hub, pages, summaries };
}

describe("md", () => {
  it("turns bold, italic and nested emphasis into runs and leaves plain text alone", () => {
    expect(md("plain 2¼ years' text")).toEqual([
      { type: "text", text: "plain 2¼ years' text", styles: {} },
    ]);
    expect(md("**Standard expected:** Level 4")).toEqual([
      { type: "text", text: "Standard expected:", styles: { bold: true } },
      { type: "text", text: " Level 4", styles: {} },
    ]);
    expect(md("⚠️ **This HiLLO has *required* evidence** (below)")).toEqual([
      { type: "text", text: "⚠️ ", styles: {} },
      { type: "text", text: "This HiLLO has ", styles: { bold: true } },
      { type: "text", text: "required", styles: { bold: true, italic: true } },
      { type: "text", text: " evidence", styles: { bold: true } },
      { type: "text", text: " (below)", styles: {} },
    ]);
  });
});

describe("kcPage", () => {
  const hillo12 = CESR_CURRICULUM[11];
  const kc128 = hillo12.kcs[7];
  const page = kcPage(hillo12, kc128, { page: "kc", hilloPage: "hillo" });

  it("is titled by number and short title, with the verbatim text as description and quote", () => {
    expect(page.title).toBe("KC 12.8 — Raised intracranial pressure");
    expect(kcTitle(kc128)).toBe(page.title);
    expect(page.parentId).toBe("hillo");
    expect(page.description).toBe(kc128.text);
    const quote = page.blocks.flat().find((b) => b.type === "quote")!;
    expect(textOf(quote)).toBe(kc128.text);
  });

  it("carries the four properties with the stable ids, Status seeded Not started", () => {
    expect(page.properties?.map((row) => row.id)).toEqual([...KC_PROPERTY_IDS]);
    expect(page.properties?.map((row) => row.type)).toEqual([
      "select",
      "date",
      "people",
      "relation",
    ]);
    expect(page.properties?.[0]).toMatchObject({ value: "Not started" });
    expect(page.properties?.[3]).toMatchObject({
      label: "Evidence",
      reverse_label: "Evidence for",
    });
  });

  it("lays out how-to, quote, three strands, own routes, notes and the back link", () => {
    const blocks = page.blocks.flat();
    expect(blocks.map((b) => b.type)).toEqual([
      "callout",
      "quote",
      "heading", // What could count
      "heading", // strand 1
      ...kc128.strands[0].items.map(() => "checkListItem"),
      "heading",
      ...kc128.strands[1].items.map(() => "checkListItem"),
      "heading",
      ...kc128.strands[2].items.map(() => "checkListItem"),
      "heading", // Your own routes
      "checkListItem",
      "heading", // Notes and gap plan
      "paragraph",
      "divider",
      "pageLink",
    ]);
    const headings = blocks.filter((b) => b.type === "heading").map(textOf);
    expect(headings).toEqual([
      "What could count",
      "Work-based assessments (aim 2–3)",
      "Clinical and experiential evidence",
      "CPD and courses",
      "Your own routes",
      "Notes and gap plan",
    ]);
    const howTo = textOf(blocks[0]);
    for (const value of STATUS_VALUES) expect(howTo).toContain(value);
    expect(howTo).toContain("Strike through");
    expect(howTo).toContain("ticks alone never change the status");
    const back = blocks.at(-1)!;
    expect(back.props).toMatchObject({
      pageId: "hillo",
      title: hilloTitle(hillo12),
    });
    // The menu items are the source items, verbatim, with emphasis rendered.
    const items = blocks.filter((b) => b.type === "checkListItem").map(textOf);
    expect(items.slice(0, -1)).toEqual(
      kc128.strands.flatMap((s) =>
        s.items.map((i) =>
          md(i)
            .map((r) => r.text)
            .join(""),
        ),
      ),
    );
    expect(items.at(-1)).toContain("«");
  });

  it("keeps the September pack's per-KC note as an italic paragraph after the quote", () => {
    const kc126 = hillo12.kcs[5];
    const withNote = kcPage(hillo12, kc126, { page: "kc", hilloPage: "hillo" });
    const blocks = withNote.blocks.flat();
    expect(blocks[1].type).toBe("quote");
    expect(blocks[2].type).toBe("paragraph");
    expect(textOf(blocks[2])).toBe(kc126.note);
    expect(page.blocks.flat()[2].type).toBe("heading"); // 12.8 has no note
  });
});

describe("hilloTree", () => {
  const trees = allTrees();
  const byTitle = new Map(trees.pages.map((p) => [p.title, p]));

  it("produces 14 HiLLO pages and 92 KC pages under them", () => {
    expect(trees.pages).toHaveLength(106);
    const hillos = trees.pages.filter((p) => p.parentId === trees.hub);
    expect(hillos).toHaveLength(14);
    expect(hillos.map((p) => p.title)).toEqual(CESR_CURRICULUM.map(hilloTitle));
    for (const hillo of hillos) {
      const kcs = trees.pages.filter((p) => p.parentId === hillo.id);
      expect(kcs.length).toBeGreaterThan(0);
      for (const kc of kcs)
        expect(kc.properties?.map((r) => r.id)).toEqual([...KC_PROPERTY_IDS]);
    }
    expect(trees.pages.filter((p) => p.title.startsWith("KC "))).toHaveLength(
      92,
    );
  });

  it("gives the HiLLO page the statement as description and the sections the spec lists", () => {
    const h12 = byTitle.get(
      "HiLLO 12 — Neurosciences intensive care medicine",
    )!;
    expect(h12.description).toBe(CESR_CURRICULUM[11].statement);
    expect(h12.properties).toBeUndefined();
    const blocks = h12.blocks.flat();
    const headings = blocks.filter((b) => b.type === "heading").map(textOf);
    expect(headings).toEqual([
      "What the curriculum asks for",
      "HiLLO-level evidence",
      "Maintenance route (>7 years)",
      "Supervisor summary",
    ]);
    expect(blocks.find((b) => b.type === "quote")).toBeDefined();
    expect(blocks.filter((b) => b.type === "bulletListItem")).toHaveLength(
      CESR_CURRICULUM[11].atAGlance.length,
    );
    expect(blocks.find((b) => b.type === "syncedBlock")).toBeDefined();
    expect(blocks.at(-1)!.props).toMatchObject({
      pageId: trees.hub,
      title: "HiLLOs",
    });
  });

  it("renders Required evidence as a red callout only for HiLLOs 10, 11, 13 and 14, and the maintenance route for 10–14", () => {
    for (const hillo of CESR_CURRICULUM) {
      const page = byTitle.get(hilloTitle(hillo))!;
      const blocks = page.blocks.flat();
      const headings = blocks.filter((b) => b.type === "heading").map(textOf);
      const red = blocks.filter(
        (b) => b.type === "callout" && b.props?.colour === "red",
      );
      expect(headings.includes("Required evidence")).toBe(
        [10, 11, 13, 14].includes(hillo.n),
      );
      expect(red).toHaveLength([10, 11, 13, 14].includes(hillo.n) ? 1 : 0);
      if (red.length) {
        expect(red[0].children?.map(textOf)).toEqual(
          hillo.required!.items.map((i) =>
            md(i)
              .map((r) => r.text)
              .join(""),
          ),
        );
      }
      expect(headings.includes("Maintenance route (>7 years)")).toBe(
        hillo.n >= 10,
      );
      expect(headings.includes("HiLLO-level evidence")).toBe(hillo.n !== 10);
    }
  });

  it("builds as a pack with no notes, 106 pages and every KC row intact", () => {
    const template: PackTemplate = {
      name: "Trees",
      purpose: "",
      description: "",
      category: "Training & Portfolio",
      audience: "",
      kind: "workspace",
      version: 1,
      changelog: "",
      pages: [
        {
          id: trees.hub,
          parentId: null,
          title: "HiLLOs",
          icon: "🎯",
          blocks: [],
        },
        ...trees.pages,
      ],
      synced: CESR_CURRICULUM.map((hillo, index) => ({
        id: trees.summaries[index],
        key: summaryKey(hillo.n),
        sourcePageId: byTitle.get(hilloTitle(hillo))!.id,
        title: `HiLLO ${hillo.n} supervisor summary`,
        blocks: supervisorSummaryBlocks(hillo.n),
      })),
    };
    const built = packToSnapshot(template, new Map(), ids());
    expect(built.snapshot.format).toBe(4);
    expect(built.snapshot.notes).toEqual([]);
    expect(built.snapshot.pages).toHaveLength(107);
    expect(built.snapshot.synced?.map((s) => s.key)).toEqual(
      CESR_CURRICULUM.map((h) => summaryKey(h.n)),
    );
    const kcPages = built.snapshot.pages.filter((p) =>
      p.title.startsWith("KC "),
    );
    expect(kcPages).toHaveLength(92);
    for (const page of kcPages) {
      expect(page.properties?.rows.map((r) => r.id)).toEqual([
        ...KC_PROPERTY_IDS,
      ]);
      expect((page.description ?? "").length).toBeGreaterThan(0);
    }
  });

  it("refuses a mismatched number of KC page ids", () => {
    expect(() =>
      hilloTree(
        CESR_CURRICULUM[0],
        { page: "p", hub: "h", kcPages: ["a"] },
        synced("s"),
      ),
    ).toThrow(/6 KCs/);
  });
});
