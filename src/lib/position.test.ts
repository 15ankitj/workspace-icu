import { describe, expect, it } from "vitest";
import {
  comparePositions,
  firstPosition,
  positionAfter,
  positionBefore,
  positionBetween,
} from "@/lib/position";

describe("fractional positioning", () => {
  it("produces a first key for an empty list", () => {
    expect(firstPosition()).toBeTruthy();
  });

  it("appends after the last sibling", () => {
    const a = firstPosition();
    const b = positionAfter(a);
    expect(comparePositions(a, b)).toBe(-1);
  });

  it("prepends before the first sibling", () => {
    const a = firstPosition();
    const b = positionBefore(a);
    expect(comparePositions(b, a)).toBe(-1);
  });

  it("inserts between two siblings without touching them", () => {
    const a = firstPosition();
    const c = positionAfter(a);
    const b = positionBetween(a, c);
    expect(comparePositions(a, b)).toBe(-1);
    expect(comparePositions(b, c)).toBe(-1);
  });

  it("supports many repeated insertions at the same point", () => {
    let low = firstPosition();
    const high = positionAfter(low);
    // Repeatedly insert just below `high`; keys must stay ordered and unique.
    const seen = new Set([low, high]);
    for (let i = 0; i < 100; i++) {
      const mid = positionBetween(low, high);
      expect(comparePositions(low, mid)).toBe(-1);
      expect(comparePositions(mid, high)).toBe(-1);
      expect(seen.has(mid)).toBe(false);
      seen.add(mid);
      low = mid;
    }
  });

  it("orders a reordering sequence correctly", () => {
    // Simulate: create three pages, drag the third between first and second.
    const p1 = firstPosition();
    const p2 = positionAfter(p1);
    const p3 = positionAfter(p2);
    const moved = positionBetween(p1, p2);
    const order = [p1, p2, p3, moved].sort(comparePositions);
    expect(order).toEqual([p1, moved, p2, p3]);
  });
});
