import { describe, expect, it } from "vitest";
import { COVER_GRADIENTS, coverGradient, isValidCover } from "@/lib/cover";

describe("isValidCover", () => {
  it("accepts in-range gradient tokens", () => {
    expect(isValidCover("gradient:0")).toBe(true);
    expect(isValidCover(`gradient:${COVER_GRADIENTS.length - 1}`)).toBe(true);
  });

  it("rejects out-of-range gradients", () => {
    expect(isValidCover(`gradient:${COVER_GRADIENTS.length}`)).toBe(false);
    expect(isValidCover("gradient:-1")).toBe(false);
  });

  it("accepts https image URLs only", () => {
    expect(isValidCover("https://example.org/cover.jpg")).toBe(true);
    expect(isValidCover("http://example.org/cover.jpg")).toBe(false);
    expect(isValidCover("javascript:alert(1)")).toBe(false);
    expect(isValidCover("cover.jpg")).toBe(false);
  });
});

describe("coverGradient", () => {
  it("maps tokens to CSS and URLs to null", () => {
    expect(coverGradient("gradient:1")).toBe(COVER_GRADIENTS[1]);
    expect(coverGradient("https://example.org/x.png")).toBeNull();
  });
});
