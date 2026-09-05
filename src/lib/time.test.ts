import { describe, expect, it } from "vitest";
import { formatRelative, formatRelativeShort } from "./time";

const NOW = Date.parse("2026-09-12T14:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatRelative", () => {
  it("steps from just now to weeks", () => {
    expect(formatRelative(ago(10_000), NOW)).toBe("just now");
    expect(formatRelative(ago(2 * 60_000), NOW)).toBe("2 min ago");
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe("3 hours ago");
    expect(formatRelative(ago(26 * 3_600_000), NOW)).toBe("yesterday");
    expect(formatRelative(ago(3 * 86_400_000), NOW)).toBe("3 days ago");
    expect(formatRelative(ago(15 * 86_400_000), NOW)).toBe("2 weeks ago");
  });

  it("falls back to a date beyond a month", () => {
    expect(formatRelative(ago(40 * 86_400_000), NOW)).toMatch(/2026/);
  });

  it("never reports the future as ago", () => {
    expect(formatRelative(new Date(NOW + 60_000).toISOString(), NOW)).toBe(
      "just now",
    );
  });
});

describe("formatRelativeShort", () => {
  it("is compact", () => {
    expect(formatRelativeShort(ago(5 * 60_000), NOW)).toBe("5m");
    expect(formatRelativeShort(ago(5 * 3_600_000), NOW)).toBe("5h");
    expect(formatRelativeShort(ago(2 * 86_400_000), NOW)).toBe("2d");
  });
});
