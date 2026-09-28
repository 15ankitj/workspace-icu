import { expect, test, type BrowserContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contextFor,
  resolveSupabaseUrl,
  signIn,
  stagingEnv,
  type Actor,
} from "./staging-helpers";

/**
 * Template instantiation against staging: a page started from a gallery
 * template must open with its content in the editor, not the empty
 * paragraph (the seed-from-blocks path in page-editor.tsx), and the seed
 * must persist to page_documents. Runs only with the STAGING_* environment
 * (see staging-helpers.ts) and skips cleanly otherwise; the page it
 * creates is deleted at the end.
 *
 *   STAGING_URL=https://<preview>.vercel.app STAGING_… npm run e2e:staging
 */

const env = stagingEnv();

interface SnapshotRow {
  type: string;
  content?: { content?: { type?: string; text?: string }[] } | null;
}

/** The first heading's text in a snapshot's first page, if any. */
function firstHeading(snapshot: unknown): string | null {
  const pages = (snapshot as { pages?: { blocks?: SnapshotRow[] }[] })?.pages;
  const rows = pages?.[0]?.blocks ?? [];
  const heading = rows.find((row) => row.type === "heading");
  const text = (heading?.content?.content ?? [])
    .filter((run) => run.type === "text")
    .map((run) => run.text ?? "")
    .join("")
    .trim();
  return text || null;
}

test.describe("starting from a template seeds the editor (staging)", () => {
  test.skip(!env, "STAGING_* environment variables are not set");
  test.setTimeout(120_000);

  let supabaseUrl: string;
  let owner: Actor;
  let context: BrowserContext;
  let workspaceId: string;
  let templateId: string;
  let templateName: string;
  let heading: string;
  let createdPageId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    supabaseUrl = await resolveSupabaseUrl(env!);
    owner = await signIn(supabaseUrl, env!.anonKey, env!.owner);

    const { data: memberships } = await owner.db
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("role", "owner");
    if (!memberships?.length) {
      throw new Error("The owner account owns no workspace");
    }
    workspaceId = memberships[0].workspace_id;

    // A published platform page template whose first page has a heading:
    // Evidence item when installed, else any that fits.
    const { data: templates } = await owner.db
      .from("templates")
      .select(
        "id, name, kind, template_versions!templates_current_version_fkey(snapshot)",
      )
      .eq("owner_scope", "platform")
      .eq("is_published", true)
      .eq("kind", "page");
    const candidates = (templates ?? [])
      .map((t) => ({
        id: t.id,
        name: t.name,
        heading: firstHeading(
          (t.template_versions as { snapshot?: unknown } | null)?.snapshot,
        ),
      }))
      .filter((t) => t.heading !== null)
      .sort((a, b) =>
        a.name === "Evidence item" ? -1 : b.name === "Evidence item" ? 1 : 0,
      );
    if (!candidates.length) {
      throw new Error(
        "No published platform page template with a heading is installed",
      );
    }
    templateId = candidates[0].id;
    templateName = candidates[0].name;
    heading = candidates[0].heading!;

    context = await contextFor(browser, owner, supabaseUrl, env!.url);
  });

  test.afterAll(async () => {
    if (owner && createdPageId) {
      await owner.db.from("pages").delete().eq("id", createdPageId);
    }
    await context?.close();
  });

  test("the new page opens with the template's first heading rendered, and the seed is saved", async () => {
    const page = await context.newPage();
    await page.goto(`${env!.url}/w/${workspaceId}/gallery/${templateId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: templateName }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Start with this template" })
      .click();
    await page.waitForURL(/\/w\/[0-9a-f-]{36}\/p\/([0-9a-f-]{36})/);
    createdPageId = page.url().match(/\/p\/([0-9a-f-]{36})/)![1];

    // Before the fix the editor showed only its empty paragraph: the
    // "Type '/'" placeholder and no heading. The seed runs after the
    // collaboration room's first sync, so allow for the round trip.
    const editor = page.locator(".bn-editor");
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("heading", { name: heading })).toBeVisible({
      timeout: 30_000,
    });

    // The seeded document is persisted like any edit.
    await expect
      .poll(
        async () => {
          // page_documents is not in the generated types (never read by
          // the app client), so this one query goes through an untyped view
          // of the same client.
          const { data } = await (owner.db as unknown as SupabaseClient)
            .from("page_documents")
            .select("page_id")
            .eq("page_id", createdPageId!)
            .maybeSingle();
          return data?.page_id ?? null;
        },
        { timeout: 30_000, message: "page_documents row for the new page" },
      )
      .toBe(createdPageId);

    // Reopening shows the same content from the stored state, not blank.
    await page.reload();
    await expect(
      page.locator(".bn-editor").getByRole("heading", { name: heading }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
