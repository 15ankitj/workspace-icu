import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * workspace_members has two foreign keys to users (user_id and invited_by),
 * so an embed written as `users (…)` is ambiguous: PostgREST answers
 * HTTP 300 (PGRST201) instead of rows, and every member reads as "A former
 * member". Each select that embeds users from workspace_members must name
 * the key it means. A string match is enough; the point is to fail the
 * moment someone reverts to the un-hinted form.
 */

const HINT = "users!workspace_members_user_id_fkey(";

const sources = {
  "page component": "../app/w/[workspaceId]/p/[pageId]/page.tsx",
  "settings page": "../app/w/[workspaceId]/settings/page.tsx",
  "relations export": "./relations-export.ts",
};

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

/** The `.select(...)` string argument that follows a `.from("<table>")`. */
function selectsFrom(source: string, table: string): string[] {
  const pattern = new RegExp(
    `\\.from\\("${table}"\\)\\s*\\.select\\(\\s*"([^"]*)"`,
    "g",
  );
  return [...source.matchAll(pattern)].map((m) => m[1]);
}

describe("workspace_members → users embeds name their foreign key", () => {
  for (const [label, relative] of Object.entries(sources)) {
    it(`${label} hints every users embed`, () => {
      const source = read(relative);
      const embeds = selectsFrom(source, "workspace_members").filter((s) =>
        s.includes("users"),
      );
      expect(embeds.length).toBeGreaterThan(0);
      for (const select of embeds) {
        expect(select).toContain(HINT);
        expect(select).not.toMatch(/users\s*\(/);
      }
    });
  }
});
