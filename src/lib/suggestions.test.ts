import { describe, expect, it } from "vitest";
import {
  allowedPageModes,
  defaultPageMode,
  excerptOf,
  isOwnSuggestion,
  makeSuggestionId,
  staleCandidates,
  suggesterName,
  suggesterPrefix,
  suggestionLabel,
} from "@/lib/suggestions";

const ME = "dece6abe-368d-4b07-be5a-df0607190847";
const OTHER = "22ec3a42-7542-4dc1-99ad-01a27245095a";

describe("suggestion ids", () => {
  it("carry the suggester and are unique per mint", () => {
    const a = makeSuggestionId(ME, () => 0.123456);
    const b = makeSuggestionId(ME, () => 0.654321);
    expect(a).toMatch(/^dece6abe:[0-9a-z]{8}$/);
    expect(a).not.toBe(b);
    expect(suggesterPrefix(a)).toBe("dece6abe");
    expect(isOwnSuggestion(a, ME)).toBe(true);
    expect(isOwnSuggestion(a, OTHER)).toBe(false);
    expect(suggesterPrefix(42)).toBeNull();
    expect(suggesterPrefix("not-an-id")).toBeNull();
    expect(
      suggesterName(a, [
        { id: OTHER, displayName: "Sam" },
        { id: ME, displayName: "Ankit" },
      ]),
    ).toBe("Ankit");
    expect(suggesterName(a, [])).toBeNull();
  });
});

describe("excerptOf", () => {
  it("strips zero-width joins and truncates", () => {
    expect(excerptOf("a\u200bb   c")).toBe("ab c");
    expect(excerptOf("x".repeat(100), 10)).toHaveLength(10);
  });
});

describe("page modes", () => {
  it("forces non-authors of authored pages into Suggest", () => {
    expect(
      defaultPageMode({
        canEdit: true,
        authored: true,
        isAuthor: false,
        suggestionsAvailable: true,
        remembered: "edit",
      }),
    ).toBe("suggest");
    expect(
      allowedPageModes({
        canEdit: true,
        authored: true,
        isAuthor: false,
        suggestionsAvailable: true,
      }),
    ).toEqual(["suggest", "view"]);
  });

  it("falls back to View without collaboration", () => {
    expect(
      defaultPageMode({
        canEdit: true,
        authored: true,
        isAuthor: false,
        suggestionsAvailable: false,
      }),
    ).toBe("view");
  });

  it("lets authors and unrestricted editors edit, remembering Suggest", () => {
    expect(
      defaultPageMode({
        canEdit: true,
        authored: true,
        isAuthor: true,
        suggestionsAvailable: true,
      }),
    ).toBe("edit");
    expect(
      defaultPageMode({
        canEdit: true,
        authored: false,
        isAuthor: false,
        suggestionsAvailable: true,
        remembered: "suggest",
      }),
    ).toBe("suggest");
    expect(
      allowedPageModes({
        canEdit: true,
        authored: false,
        isAuthor: false,
        suggestionsAvailable: true,
      }),
    ).toEqual(["edit", "suggest", "view"]);
    expect(
      defaultPageMode({
        canEdit: false,
        authored: false,
        isAuthor: false,
        suggestionsAvailable: true,
      }),
    ).toBe("view");
  });
});

describe("block-level suggestions", () => {
  it("labels inline and block-level shapes", () => {
    const shape = (kinds: string[], blockLevel: boolean) => ({
      kinds: new Set(kinds as ("insertion" | "deletion" | "modification")[]),
      blockLevel,
    });
    expect(suggestionLabel(shape(["insertion"], false))).toBe("Insert");
    expect(suggestionLabel(shape(["insertion", "deletion"], false))).toBe(
      "Replace",
    );
    expect(suggestionLabel(shape(["modification"], false))).toBe("Change");
    expect(suggestionLabel(shape(["deletion"], true))).toBe("Delete block");
    expect(suggestionLabel(shape(["insertion", "deletion"], true))).toBe(
      "Move block",
    );
  });

  it("finds suggestions removed by a local edit and still open", () => {
    expect(staleCandidates(["a", "b", "c"], ["b"], ["a", "b"])).toEqual(["a"]);
    expect(staleCandidates([], ["b"], ["b"])).toEqual([]);
    expect(staleCandidates(["a"], [], [])).toEqual([]);
  });
});
