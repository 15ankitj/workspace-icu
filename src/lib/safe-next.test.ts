import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
  it("keeps site-relative paths with their query", () => {
    expect(safeNextPath("/w/abc/p/def?tree=1&markup=1")).toBe(
      "/w/abc/p/def?tree=1&markup=1",
    );
    expect(safeNextPath("/")).toBe("/");
  });

  it("refuses everything that would leave the site", () => {
    for (const bad of [
      "//evil.example",
      "//evil.example/path",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ /evil.example",
      "/\t/evil.example",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
