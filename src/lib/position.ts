import { generateKeyBetween } from "fractional-indexing";

/**
 * Fractional-index helpers for ordering siblings (pages, favourites, later
 * blocks) without renumbering. Positions are plain strings; ordering is
 * lexicographic. Wraps `fractional-indexing` so callers never pass raw
 * neighbours in the wrong order.
 */

/** A key sorting after every existing sibling. */
export function positionAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

/** A key sorting before every existing sibling. */
export function positionBefore(first: string | null): string {
  return generateKeyBetween(null, first);
}

/** A key strictly between two siblings; either side may be open-ended. */
export function positionBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}

/** First key for an empty sibling list. */
export function firstPosition(): string {
  return generateKeyBetween(null, null);
}

export function comparePositions(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
