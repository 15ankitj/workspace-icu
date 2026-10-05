import { describe, expect, it } from "vitest";
import { CESR_CURRICULUM } from "./cesr-curriculum";
import { CESR_HILLO_GUIDANCE } from "./cesr-hillo-guidance";

/** Every string of one entry. */
function stringsOf(entry: (typeof CESR_HILLO_GUIDANCE)[number]): string[] {
  return [
    entry.lookFor,
    ...entry.minimum,
    ...entry.pitfalls,
    ...entry.alsoServes,
  ];
}

describe("CESR HiLLO supervisor guidance", () => {
  it("has one entry per HiLLO, numbered 1–14 in order", () => {
    expect(CESR_HILLO_GUIDANCE).toHaveLength(14);
    expect(CESR_HILLO_GUIDANCE.map((g) => g.n)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(CESR_HILLO_GUIDANCE.map((g) => g.n)).toEqual(
      CESR_CURRICULUM.map((h) => h.n),
    );
  });

  it("gives each HiLLO a reading, 3–4 minimum items, 3 pitfalls and 3+ overlaps", () => {
    for (const entry of CESR_HILLO_GUIDANCE) {
      expect(entry.lookFor.trim().length).toBeGreaterThan(0);
      expect(entry.minimum.length).toBeGreaterThanOrEqual(3);
      expect(entry.minimum.length).toBeLessThanOrEqual(4);
      expect(entry.pitfalls).toHaveLength(3);
      expect(entry.alsoServes.length).toBeGreaterThanOrEqual(3);
      for (const overlap of entry.alsoServes) {
        expect(overlap).toMatch(/^HiLLO/);
      }
      for (const text of stringsOf(entry)) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("carries no numeric WBA targets", () => {
    const target = /\b\d+\s*[–-]\s*\d+\s*(CBD|Mini-CEX|DOPS|ACAT|MSF|SLE|WBA)/i;
    for (const entry of CESR_HILLO_GUIDANCE) {
      for (const text of stringsOf(entry)) {
        expect(text).not.toMatch(target);
      }
    }
  });

  it("asks for no identifiers", () => {
    for (const entry of CESR_HILLO_GUIDANCE) {
      for (const text of stringsOf(entry)) {
        expect(text).not.toMatch(/GMC number/i);
        expect(text).not.toMatch(/date of birth/i);
      }
    }
  });
});
