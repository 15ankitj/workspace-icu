import { describe, expect, it } from "vitest";
import {
  buildDigest,
  describeCounts,
  describeNotification,
  digestSubject,
  type DigestRow,
} from "@/lib/digest";

const row = (
  page: string,
  kind: DigestRow["kind"],
  actor: string | null = "Sam",
  ws = "A",
): DigestRow => ({
  workspaceId: ws,
  workspaceName: `Workspace ${ws}`,
  pageId: page,
  pageTitle: `Page ${page}`,
  kind,
  actorName: actor,
});

describe("buildDigest", () => {
  it("groups by workspace and page, busiest page first, distinct actors", () => {
    const digest = buildDigest([
      row("p1", "suggestion_created"),
      row("p2", "suggestion_reply", "Ash"),
      row("p2", "suggestion_created", "Sam"),
      row("p2", "suggestion_created", "Sam"),
      row("q1", "suggestion_accepted", null, "B"),
    ]);
    expect(digest.map((w) => w.workspaceName)).toEqual([
      "Workspace A",
      "Workspace B",
    ]);
    const a = digest[0];
    expect(a.total).toBe(4);
    expect(a.pages.map((p) => p.pageId)).toEqual(["p2", "p1"]);
    expect(a.pages[0].counts).toEqual({
      suggestion_reply: 1,
      suggestion_created: 2,
    });
    expect(a.pages[0].actors).toEqual(["Ash", "Sam"]);
    expect(digest[1].pages[0].actors).toEqual([]);
  });
});

describe("wording", () => {
  it("describes counts in a fixed order with plurals", () => {
    expect(
      describeCounts({
        suggestion_rejected: 1,
        suggestion_created: 2,
        suggestion_reply: 1,
      }),
    ).toBe("2 new suggestions, 1 reply, 1 suggestion rejected");
    expect(describeCounts({})).toBe("");
    expect(digestSubject(1)).toBe("1 suggestion update on WorkspaceICU");
    expect(describeNotification("suggestion_accepted", null)).toBe(
      "Someone accepted your suggestion",
    );
  });
});
