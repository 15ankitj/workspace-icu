import { describe, expect, it } from "vitest";
import type { EditorBlock } from "@/lib/blocks";
import {
  blockSuggestionOf,
  decodeSuggestionAttr,
  dominantKind,
  encodeSuggestionAttr,
  inlineSuggestionOf,
  suggestionIdsIn,
} from "@/lib/suggestion-markup";

describe("suggestion attribute", () => {
  it("round-trips suggestion marks and drops everything else", () => {
    const encoded = encodeSuggestionAttr([
      { type: "insertion", attrs: { id: "dece6abe:abc12345" } },
      { type: "modification", attrs: { id: "x", attrName: "checked" } },
    ]);
    expect(encoded).toBeTypeOf("string");
    expect(decodeSuggestionAttr(encoded)).toEqual([
      { type: "insertion", attrs: { id: "dece6abe:abc12345" } },
      { type: "modification", attrs: { id: "x", attrName: "checked" } },
    ]);
    expect(encodeSuggestionAttr([])).toBeNull();
    expect(decodeSuggestionAttr(null)).toEqual([]);
    expect(decodeSuggestionAttr("not json")).toEqual([]);
    expect(decodeSuggestionAttr('[{"type":"bold"}]')).toEqual([]);
  });

  it("picks the dominant kind for a block", () => {
    expect(dominantKind(["modification", "deletion"])).toBe("deletion");
    expect(dominantKind(["deletion", "insertion"])).toBe("insertion");
    expect(
      blockSuggestionOf(
        encodeSuggestionAttr([
          { type: "deletion", attrs: { id: "a:1" } },
          { type: "insertion", attrs: { id: "a:2" } },
        ]),
      ),
    ).toEqual({ kind: "insertion", id: "a:2" });
    expect(blockSuggestionOf(null)).toBeNull();
  });

  it("reads inline markup from export styles", () => {
    expect(
      inlineSuggestionOf({
        bold: true,
        suggestion: "deletion",
        suggestionId: "a:1",
      }),
    ).toEqual({ kind: "deletion", id: "a:1" });
    expect(inlineSuggestionOf({ bold: true })).toBeNull();
  });

  it("lists every suggestion id in a marked document once", () => {
    const doc: EditorBlock[] = [
      {
        id: "1",
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "a",
            styles: { suggestion: "insertion", suggestionId: "s:1" },
          },
          {
            type: "link",
            href: "https://example.org",
            content: [
              {
                type: "text",
                text: "b",
                styles: { suggestion: "deletion", suggestionId: "s:2" },
              },
            ],
          },
        ],
        children: [
          {
            id: "2",
            type: "paragraph",
            content: [],
            suggestion: { kind: "insertion", id: "s:3" },
          },
        ],
      },
      {
        id: "3",
        type: "table",
        content: {
          rows: [
            {
              cells: [
                {
                  content: [
                    {
                      type: "text",
                      text: "c",
                      styles: { suggestion: "insertion", suggestionId: "s:1" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ];
    expect(suggestionIdsIn(doc)).toEqual(["s:1", "s:2", "s:3"]);
  });
});
