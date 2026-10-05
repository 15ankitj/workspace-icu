import { describe, expect, it } from "vitest";
import {
  ANAESTHESIA_MILESTONES,
  MILESTONE_PHASES,
  MILESTONE_STRANDS,
} from "./cesr-anaesthesia-rotation";
import { CESR_CURRICULUM } from "./cesr-curriculum";

const hillo10 = CESR_CURRICULUM.find((h) => h.n === 10)!;
const kcIds = hillo10.kcs.map((kc) => kc.id);

/** Every string of one milestone. */
const stringsOf = (m: (typeof ANAESTHESIA_MILESTONES)[number]) =>
  [m.title, m.note ?? "", m.evidence, m.phase, m.strand].filter(Boolean);

describe("Anaesthesia rotation milestones", () => {
  it("has 60 milestones with unique, slug-shaped ids", () => {
    expect(ANAESTHESIA_MILESTONES).toHaveLength(60);
    const ids = ANAESTHESIA_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    const titles = ANAESTHESIA_MILESTONES.map((m) => m.title);
    // Page keys match by title under the phase page, so titles must be
    // unique too, or a rebuild would conflate two milestones.
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("serves only HiLLO 10 KCs, and every KC 10.x is served", () => {
    expect(kcIds).toEqual([
      "10.1",
      "10.2",
      "10.3",
      "10.4",
      "10.5",
      "10.6",
      "10.7",
      "10.8",
      "10.9",
      "10.10",
    ]);
    const served = new Set<string>();
    for (const m of ANAESTHESIA_MILESTONES) {
      expect(m.serves.length).toBeGreaterThan(0);
      for (const kc of m.serves) {
        expect(kcIds).toContain(kc);
        served.add(kc);
      }
    }
    expect([...served].sort()).toEqual([...kcIds].sort());
  });

  it("uses every phase and strand value", () => {
    for (const phase of MILESTONE_PHASES) {
      expect(ANAESTHESIA_MILESTONES.some((m) => m.phase === phase)).toBe(true);
    }
    for (const strand of MILESTONE_STRANDS) {
      expect(ANAESTHESIA_MILESTONES.some((m) => m.strand === strand)).toBe(
        true,
      );
    }
  });

  it("carries no numeric targets", () => {
    for (const m of ANAESTHESIA_MILESTONES) {
      for (const text of stringsOf(m)) {
        expect(text).not.toMatch(/\b\d+\s*\+/);
        expect(text).not.toMatch(/\b(80|100|target)\b/i);
      }
    }
  });

  it("keeps the numbers in notes to the GMC ones and ASA or phase labels", () => {
    for (const m of ANAESTHESIA_MILESTONES) {
      if (!m.note) continue;
      // Strip ASA grade labels ("ASA 1–2", "ASA 3") and count what is left.
      const stripped = m.note.replace(/ASA\s+\d+(?:[–-]\d+)?[E]?/g, "");
      const numbers = stripped.match(/\d+/g) ?? [];
      for (const n of numbers) {
        expect(["1", "2", "3", "12", "300"]).toContain(n);
      }
    }
  });
});
