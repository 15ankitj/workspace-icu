import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSION_ERROR } from "@/lib/action-result";

/**
 * Every action file, one failing Supabase call: the result is
 * { ok: false, error } and nothing is thrown. The client mock refuses
 * every query and RPC with a permission error; reads that come back empty
 * lead to the action's own "not found" sentence, which is a result too.
 */

const DENIED = {
  name: "PostgrestError",
  code: "42501",
  message: "permission denied for table x",
  details: "",
  hint: "",
};

const getUser = vi.fn();
const rpc = vi.fn();
const signOut = vi.fn();
const storageOp = vi.fn().mockResolvedValue({ data: null, error: null });

/** A query builder whose every method chains and whose await refuses. */
function chain(): unknown {
  const result = { data: null, error: DENIED, count: null };
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject);
        }
        return () => proxy;
      },
    },
  );
  return proxy;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, signOut },
    from: () => chain(),
    rpc,
    storage: {
      from: () => ({
        upload: storageOp,
        copy: storageOp,
        remove: storageOp,
        download: storageOp,
      }),
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("redirect:")) {
      throw error;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/liveblocks-admin", () => ({
  deleteLiveblocksRoom: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => false,
  sendEmail: vi.fn(),
  inviteEmail: vi.fn(),
}));

import * as account from "./account";
import * as blocks from "./blocks";
import * as collab from "./collab";
import * as comments from "./comments";
import * as files from "./files";
import * as imports from "./import";
import * as invites from "./invites";
import * as packs from "./packs";
import * as pages from "./pages";
import * as relations from "./relations";
import * as reports from "./reports";
import * as search from "./search";
import * as shares from "./shares";
import * as suggestions from "./suggestions";
import * as synced from "./synced";
import * as templates from "./templates";
import * as trash from "./trash";
import * as workspaces from "./workspaces";

const USER = "dece6abe-368d-4b07-be5a-df0607190847";
const PAGE = "0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b";
const OTHER = "22ec3a42-7542-4dc1-99ad-01a27245095a";

function fd(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: USER } } });
  rpc.mockReset().mockResolvedValue({ data: null, error: DENIED });
  signOut.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const cases: [string, () => Promise<unknown>, string | RegExp][] = [
  ["pages.renamePage", () => pages.renamePage(PAGE, "t"), PERMISSION_ERROR],
  ["pages.createPage", () => pages.createPage("w", null), PERMISSION_ERROR],
  [
    "pages.movePage",
    () =>
      pages.movePage({
        workspaceId: "w",
        pageId: PAGE,
        newParentId: null,
        beforeId: null,
        afterId: null,
      }),
    PERMISSION_ERROR,
  ],
  [
    "synced.createSyncedBlock",
    () => synced.createSyncedBlock(PAGE, []),
    PERMISSION_ERROR,
  ],
  [
    "synced.saveSyncedBlock",
    () => synced.saveSyncedBlock("s", "abc", [], PAGE),
    PERMISSION_ERROR,
  ],
  [
    "synced.listSyncedHosts",
    () => synced.listSyncedHosts("s"),
    PERMISSION_ERROR,
  ],
  [
    "relations.addRelationLink",
    () => relations.addRelationLink(PAGE, "evidence", OTHER),
    "Page not found.",
  ],
  [
    "relations.removeRelationLink",
    () => relations.removeRelationLink(PAGE),
    "You need edit access to both pages to change this link.",
  ],
  [
    "relations.addRelationLink (bad id)",
    () => relations.addRelationLink("nope", "x", OTHER),
    "Invalid request.",
  ],
  [
    "templates.saveAsTemplate",
    () =>
      templates.saveAsTemplate({
        workspaceId: "w",
        sourcePageId: PAGE,
        kind: "page",
        scope: "workspace",
        name: "T",
        purpose: "",
        description: "",
        category: "Personal",
        audience: "",
      }),
    PERMISSION_ERROR,
  ],
  [
    "templates.instantiateTemplate",
    () =>
      templates.instantiateTemplate({
        templateId: "t",
        workspaceId: "w",
        parentPageId: null,
      }),
    "Template not found.",
  ],
  [
    "templates.startFromTemplate",
    () =>
      templates.startFromTemplate(
        null,
        fd({ templateId: "t", workspaceId: "w" }),
      ),
    "Template not found.",
  ],
  [
    "templates.deleteTemplate",
    () =>
      templates.deleteTemplate(null, fd({ templateId: "t", workspaceId: "w" })),
    PERMISSION_ERROR,
  ],
  [
    "invites.createInvite",
    () =>
      invites.createInvite(
        null,
        fd({ workspaceId: "w", email: "a@b.co", role: "editor" }),
      ),
    "Workspace not found.",
  ],
  [
    "invites.createInvite (bad email)",
    () => invites.createInvite(null, fd({ workspaceId: "w", email: "nope" })),
    "Enter a valid email address.",
  ],
  [
    "invites.removeMember",
    () => invites.removeMember(null, fd({ workspaceId: "w", userId: OTHER })),
    PERMISSION_ERROR,
  ],
  [
    "invites.updateMemberRole (self)",
    () =>
      invites.updateMemberRole(
        null,
        fd({ workspaceId: "w", userId: USER, role: "viewer" }),
      ),
    "You cannot change your own role.",
  ],
  [
    "files.registerUpload",
    () =>
      files.registerUpload(PAGE, {
        filename: "a.png",
        mime: "image/png",
        sizeBytes: 10,
      }),
    "Page not found.",
  ],
  ["files.deleteFile", () => files.deleteFile("f"), PERMISSION_ERROR],
  ["files.countMyUploads", () => files.countMyUploads(), PERMISSION_ERROR],
  [
    "trash.restorePage",
    () => trash.restorePage(null, fd({ workspaceId: "w", pageId: PAGE })),
    "Page is not in the trash.",
  ],
  [
    "trash.purgePage",
    () => trash.purgePage(null, fd({ workspaceId: "w", pageId: PAGE })),
    "Page is not in the trash.",
  ],
  [
    "import.createEmptyPage",
    () => imports.createEmptyPage("w", null, "T"),
    PERMISSION_ERROR,
  ],
  [
    "collab.savePageDocument",
    () => collab.savePageDocument(PAGE, "abc", []),
    PERMISSION_ERROR,
  ],
  [
    "packs.installPack",
    () =>
      packs.installPack(null, fd({ name: "CESR Journey", workspaceId: "w" })),
    PERMISSION_ERROR,
  ],
  [
    "packs.installPack (unknown)",
    () => packs.installPack(null, fd({ name: "Nope", workspaceId: "w" })),
    "Unknown pack.",
  ],
  [
    "blocks.savePageContent",
    () => blocks.savePageContent(PAGE, []),
    PERMISSION_ERROR,
  ],
  [
    "reports.reportPage",
    () => reports.reportPage(PAGE, "bad"),
    "Page not found.",
  ],
  [
    "reports.reportPage (empty)",
    () => reports.reportPage(PAGE, "  "),
    "Please say what you are reporting.",
  ],
  [
    "comments.addComment",
    () => comments.addComment("w", PAGE, "hi"),
    PERMISSION_ERROR,
  ],
  [
    "comments.deleteComment",
    () => comments.deleteComment("w", PAGE, "c"),
    PERMISSION_ERROR,
  ],
  [
    "workspaces.createWorkspace",
    () => workspaces.createWorkspace(null, fd({ name: "New" })),
    PERMISSION_ERROR,
  ],
  [
    "workspaces.renameWorkspace",
    () =>
      workspaces.renameWorkspace(null, fd({ workspaceId: "w", name: "New" })),
    PERMISSION_ERROR,
  ],
  [
    "shares.setPublicLink",
    () => shares.setPublicLink(PAGE, true),
    "Page not found.",
  ],
  [
    "account.deleteMyAccount",
    () => account.deleteMyAccount(null, fd({ confirm: "delete my account" })),
    PERMISSION_ERROR,
  ],
  [
    "account.deleteMyAccount (phrase)",
    () => account.deleteMyAccount(null, fd({ confirm: "no" })),
    "Type “delete my account” to confirm.",
  ],
  ["search.searchPages", () => search.searchPages("hello"), PERMISSION_ERROR],
  [
    "suggestions.setPageAuthorship",
    () => suggestions.setPageAuthorship("w", PAGE, true, []),
    PERMISSION_ERROR,
  ],
  [
    "suggestions.setEmailDigest",
    () =>
      suggestions.setEmailDigest(
        null,
        fd({ workspaceId: "w", enabled: "true" }),
      ),
    PERMISSION_ERROR,
  ],
];

describe("every action returns a failing Supabase call as a result", () => {
  it.each(cases)("%s", async (_name, call, expected) => {
    const result = (await call()) as { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    if (typeof expected === "string") expect(result.error).toBe(expected);
    else expect(result.error).toMatch(expected);
  });

  it("acceptInvite keeps its reason and adds the sentence", async () => {
    await expect(invites.acceptInvite("tok")).resolves.toMatchObject({
      ok: false,
      reason: "unknown",
      message: DENIED.message,
      error: "Permission denied for table x.",
    });
  });

  it("marks an authored-content refusal by code for the editor's quiet retry", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message:
          "authored_content: only the page author can change its text — suggest instead",
      },
    });
    await expect(blocks.savePageContent(PAGE, [])).resolves.toEqual({
      ok: false,
      error: "Only the page author can change its text — suggest instead.",
      code: "authored_content",
    });
    await expect(
      collab.savePageDocument(PAGE, "abc", []),
    ).resolves.toMatchObject({ ok: false, code: "authored_content" });
  });

  it("still redirects a signed-out caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(pages.renamePage(PAGE, "t")).rejects.toThrow(
      "redirect:/sign-in",
    );
    await expect(
      invites.revokeInvite(null, fd({ inviteId: "i", workspaceId: "w" })),
    ).rejects.toThrow("redirect:/sign-in");
  });
});
