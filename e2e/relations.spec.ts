import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import {
  contextFor,
  resolveSupabaseUrl,
  signIn,
  stagingEnv,
  type Actor,
} from "./staging-helpers";

/**
 * Relation properties against staging (Appendix B §6), the four scenarios:
 * two-page link and reverse visibility; a view-only user refused; trash,
 * restore and purge; the permission placeholder. Runs only with the
 * STAGING_* environment (see staging-helpers.ts) and skips cleanly
 * otherwise. Data is created under unique titles and removed at the end;
 * the editor's role is put back to editor whatever happens.
 *
 *   STAGING_URL=https://<preview>.vercel.app STAGING_… npm run e2e:staging
 */

const env = stagingEnv();
const RUN = `${Date.now().toString(36)}`;
const TITLE_A = `E2E relations A ${RUN}`;
const TITLE_B = `E2E relations B ${RUN}`;
const TITLE_P = `E2E relations private ${RUN}`;
const LABEL = "Evidence";
const REVERSE = "Evidence for";
const PLACEHOLDER = "A page you don't have access to";

test.describe("relation properties on staging (Appendix B §6)", () => {
  test.skip(!env, "STAGING_* environment variables are not set");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  let supabaseUrl: string;
  let owner: Actor;
  let editor: Actor;
  let ownerContext: BrowserContext;
  let editorContext: BrowserContext;
  let workspaceId: string;
  let pageA: string;
  let pageB: string;
  let pageP: string;
  let propertyId: string;
  let bPurged = false;

  const site = () => env!.url;
  const pageUrl = (id: string) => `${site()}/w/${workspaceId}/p/${id}`;
  const details = (page: Page) =>
    page.getByRole("region", { name: "Page details" });
  const reversePanel = (page: Page) =>
    page.getByRole("region", { name: "Linked from" });

  async function setRole(role: "editor" | "viewer") {
    const { error } = await owner.db
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", editor.userId);
    if (error)
      throw new Error(`Could not set the editor's role: ${error.message}`);
  }

  async function createPage(
    actor: Actor,
    title: string,
    extra: { is_private?: boolean } = {},
  ): Promise<string> {
    const { data, error } = await actor.db
      .from("pages")
      .insert({
        workspace_id: workspaceId,
        title,
        position: "zz",
        created_by: actor.userId,
        ...extra,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create ${title}: ${error.message}`);
    return data.id;
  }

  /** The relation row's id on A, once the UI has created it. */
  async function readPropertyId(): Promise<string> {
    const { data } = await owner.db
      .from("pages")
      .select("properties")
      .eq("id", pageA)
      .single();
    const rows =
      (
        data?.properties as {
          rows?: { id: string; type: string; label: string }[];
        }
      )?.rows ?? [];
    const row = rows.find((r) => r.type === "relation" && r.label === LABEL);
    if (!row) throw new Error("The relation row was not saved on page A");
    return row.id;
  }

  async function insertLink(actor: Actor, target: string): Promise<string> {
    const { data, error } = await actor.db
      .from("page_relations")
      .insert({
        workspace_id: workspaceId,
        source_page_id: pageA,
        source_property_id: propertyId,
        target_page_id: target,
        position: `a${Date.now().toString(36)}`,
        created_by: actor.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not insert a link: ${error.message}`);
    return data.id;
  }

  test.beforeAll(async ({ browser }) => {
    supabaseUrl = await resolveSupabaseUrl(env!);
    owner = await signIn(supabaseUrl, env!.anonKey, env!.owner);
    editor = await signIn(supabaseUrl, env!.anonKey, env!.editor);

    // The workspace both accounts belong to, with the owner as owner.
    const [{ data: ownerRows }, { data: editorRows }] = await Promise.all([
      owner.db.from("workspace_members").select("workspace_id, role"),
      editor.db.from("workspace_members").select("workspace_id, role"),
    ]);
    const editorIn = new Set((editorRows ?? []).map((r) => r.workspace_id));
    const shared = (ownerRows ?? []).find(
      (r) => r.role === "owner" && editorIn.has(r.workspace_id),
    );
    if (!shared) {
      throw new Error(
        "The owner and editor accounts share no workspace the owner owns",
      );
    }
    workspaceId = shared.workspace_id;
    await setRole("editor");

    pageA = await createPage(owner, TITLE_A);
    pageB = await createPage(owner, TITLE_B);
    pageP = await createPage(editor, TITLE_P, { is_private: true });

    ownerContext = await contextFor(browser, owner, supabaseUrl, site());
    editorContext = await contextFor(browser, editor, supabaseUrl, site());
  });

  test.afterAll(async () => {
    if (!owner) return;
    await setRole("editor").catch(() => {});
    if (editor && pageP) {
      await editor.db.from("pages").delete().eq("id", pageP);
    }
    const ids = [pageA, pageB].filter(Boolean);
    if (ids.length) await owner.db.from("pages").delete().in("id", ids);
    await ownerContext?.close();
    await editorContext?.close();
  });

  test("1. a link made on A shows on B under the reverse label and is removable from B", async () => {
    const page = await ownerContext.newPage();
    await page.goto(pageUrl(pageA));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Add property → Relation, named in the dialog.
    await details(page).getByRole("button", { name: "Add a property" }).click();
    const relationItem = page.getByRole("menuitem", { name: /^Relation/ });
    if ((await relationItem.count()) === 0) {
      throw new Error(
        `"Relation" is not offered on ${site()}: is FEATURE_RELATIONS on for this preview?`,
      );
    }
    await relationItem.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name on this page").fill(LABEL);
    await expect(dialog.getByLabel("Name on the linked pages")).toHaveValue(
      REVERSE,
    );
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Add relation" }).click(),
    ]);
    await expect(details(page).getByText(LABEL, { exact: true })).toBeVisible();
    propertyId = await readPropertyId();

    // Pick B in the page search.
    await details(page).getByRole("button", { name: "Add page" }).click();
    await page.getByPlaceholder("Find a page…").fill(TITLE_B);
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.getByRole("listbox").getByRole("button", { name: TITLE_B }).click(),
    ]);
    await page.keyboard.press("Escape");
    await expect(
      details(page).getByRole("link", { name: TITLE_B }),
    ).toBeVisible();

    // Persisted: still there after a reload.
    await page.reload();
    await expect(
      details(page).getByRole("link", { name: TITLE_B }),
    ).toBeVisible();

    // The reverse side on B, within one refresh.
    await page.goto(pageUrl(pageB));
    await expect(reversePanel(page).getByText(REVERSE)).toBeVisible();
    await expect(
      reversePanel(page).getByRole("link", { name: TITLE_A }),
    ).toBeVisible();

    // Removing from B removes it from A.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      reversePanel(page)
        .getByRole("button", { name: `Remove ${TITLE_A}` })
        .click(),
    ]);
    await expect(
      reversePanel(page).getByRole("link", { name: TITLE_A }),
    ).toHaveCount(0);
    await page.goto(pageUrl(pageA));
    await expect(
      details(page).getByRole("link", { name: TITLE_B }),
    ).toHaveCount(0);
    await page.close();

    // A → B again, for the scenarios that follow.
    await insertLink(owner, pageB);
  });

  test("2. a view-only member sees the link but cannot add or remove one", async () => {
    await setRole("viewer");
    try {
      const page = await editorContext.newPage();
      await page.goto(pageUrl(pageA));
      await expect(
        details(page).getByRole("link", { name: TITLE_B }),
      ).toBeVisible();
      await expect(
        details(page).getByRole("button", { name: /^Add( page)?$/ }),
      ).toHaveCount(0);
      await expect(
        details(page).getByRole("button", { name: /^Remove / }),
      ).toHaveCount(0);
      await page.close();

      // And the database refuses the write outright.
      const { error } = await editor.db.from("page_relations").insert({
        workspace_id: workspaceId,
        source_page_id: pageA,
        source_property_id: propertyId,
        target_page_id: pageP,
        position: "zz",
        created_by: editor.userId,
      });
      expect(error, "a viewer's insert must be refused").not.toBeNull();
      const { data: deleted } = await editor.db
        .from("page_relations")
        .delete()
        .eq("source_page_id", pageA)
        .select("id");
      expect(deleted ?? []).toHaveLength(0);
    } finally {
      await setRole("editor");
    }
  });

  test("4. a link to a page the viewer cannot see is a placeholder, and the page is nowhere else", async () => {
    // The editor links A to their private page P (they can edit both).
    await insertLink(editor, pageP);

    const page = await ownerContext.newPage();
    await page.goto(pageUrl(pageA));
    await expect(details(page).getByText(PLACEHOLDER)).toBeVisible();
    await expect(page.getByText(TITLE_P)).toHaveCount(0);

    // Not offered by the picker.
    await details(page).getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Find a page…").fill(TITLE_P);
    await expect(page.getByText("No matching pages.")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.close();

    // Not in search, not in the export.
    const { data: hits } = await owner.db.rpc("search_pages", {
      p_query: TITLE_P,
    });
    expect((hits ?? []).some((h) => h.id === pageP)).toBe(false);
    const response = await ownerContext.request.get(
      `${site()}/api/export/${pageA}`,
    );
    expect(response.ok()).toBe(true);
    const zip = unzipSync(new Uint8Array(await response.body()));
    const markdown = Object.entries(zip)
      .filter(
        ([name]) => name.endsWith(".md") && !name.startsWith("EXPORT-NOTES"),
      )
      .map(([, bytes]) => strFromU8(bytes))
      .join("\n");
    expect(markdown).toContain(`**${LABEL}:**`);
    expect(markdown).toContain(TITLE_B);
    expect(markdown).not.toContain(TITLE_P);
    expect(markdown).not.toContain(PLACEHOLDER);
  });

  test("3. trash shows '(in trash)', restore clears it, purge removes the link and audits it", async () => {
    const { data: link } = await owner.db
      .from("page_relations")
      .select("id")
      .eq("source_page_id", pageA)
      .eq("target_page_id", pageB)
      .single();
    if (!link) throw new Error("The A → B link is missing");

    const page = await ownerContext.newPage();
    // Trash B.
    await owner.db
      .from("pages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", pageB);
    await page.goto(pageUrl(pageA));
    await expect(details(page).getByText("(in trash)")).toBeVisible();
    await expect(details(page).getByText(TITLE_B)).toBeVisible();
    await expect(
      details(page).getByRole("link", { name: TITLE_B }),
    ).toHaveCount(0);

    // Restore B.
    await owner.db.from("pages").update({ deleted_at: null }).eq("id", pageB);
    await page.reload();
    await expect(
      details(page).getByRole("link", { name: TITLE_B }),
    ).toBeVisible();
    await expect(details(page).getByText("(in trash)")).toHaveCount(0);

    // Purge B: the link goes by cascade and the audit says why.
    const { error } = await owner.db.from("pages").delete().eq("id", pageB);
    if (error) throw new Error(`Could not purge B: ${error.message}`);
    bPurged = true;
    await page.reload();
    await expect(details(page).getByText(TITLE_B)).toHaveCount(0);
    await page.close();

    await expect
      .poll(async () => {
        const { data } = await owner.db
          .from("audit_events")
          .select("metadata")
          .eq("event_type", "relation.link_removed")
          .eq("target_id", link.id)
          .maybeSingle();
        return (data?.metadata as { reason?: string } | null)?.reason ?? null;
      })
      .toBe("purge");
    expect(bPurged).toBe(true);
  });
});
