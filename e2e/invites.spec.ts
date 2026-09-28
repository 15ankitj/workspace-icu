import { expect, test } from "@playwright/test";
import { inviteFailureReason } from "../src/lib/invites";
import {
  resolveSupabaseUrl,
  signIn,
  stagingEnv,
  type Actor,
} from "./staging-helpers";

/**
 * `accept_invite` (migration 0028) against staging, through the same RPC
 * the app calls, as the real accounts: the success path, idempotent
 * re-acceptance by the same person, and each failure with its stable
 * reason. No browser is needed; the invitations are created by the owner
 * under RLS and removed at the end. Runs only with the STAGING_*
 * environment (see staging-helpers.ts) and skips cleanly otherwise.
 *
 *   STAGING_URL=https://<preview>.vercel.app STAGING_… npm run e2e:staging
 */

const env = stagingEnv();
const RUN = Date.now().toString(36);

test.describe("accept_invite on staging (migration 0028)", () => {
  test.skip(!env, "STAGING_* environment variables are not set");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let owner: Actor;
  let editor: Actor;
  let workspaceId: string;
  const inviteIds: string[] = [];

  async function invite(
    email: string,
    extra: { expires_at?: string } = {},
  ): Promise<{ id: string; token: string }> {
    const { data, error } = await owner.db
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email,
        role: "viewer",
        invited_by: owner.userId,
        ...extra,
      })
      .select("id, token")
      .single();
    if (error)
      throw new Error(`Could not create an invitation: ${error.message}`);
    inviteIds.push(data.id);
    return data;
  }

  const accept = (actor: Actor, token: string) =>
    actor.db.rpc("accept_invite", { p_token: token });

  test.beforeAll(async () => {
    const supabaseUrl = await resolveSupabaseUrl(env!);
    owner = await signIn(supabaseUrl, env!.anonKey, env!.owner);
    editor = await signIn(supabaseUrl, env!.anonKey, env!.editor);

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
    // One pending invitation per address: clear any left by an earlier run.
    await owner.db
      .from("workspace_invites")
      .delete()
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .in("email", [editor.account.email.toLowerCase()]);
  });

  test.afterAll(async () => {
    if (owner && inviteIds.length) {
      await owner.db.from("workspace_invites").delete().in("id", inviteIds);
    }
  });

  test("a valid invitation is accepted, and accepting it again is the same success", async () => {
    const { id, token } = await invite(editor.account.email);

    const first = await accept(editor, token);
    expect(first.error).toBeNull();
    expect(first.data).toBe(workspaceId);

    const { data: row } = await owner.db
      .from("workspace_invites")
      .select("accepted_at, accepted_by")
      .eq("id", id)
      .single();
    expect(row?.accepted_by).toBe(editor.userId);
    expect(row?.accepted_at).not.toBeNull();

    // The invite page rendering twice calls this twice.
    const again = await accept(editor, token);
    expect(again.error).toBeNull();
    expect(again.data).toBe(workspaceId);

    // Someone else with the same link is refused, and told why.
    const other = await accept(owner, token);
    expect(other.data).toBeNull();
    expect(other.error?.code).toBe("IV409");
    expect(other.error?.details).toBe("already_used_by_other");
    expect(inviteFailureReason(other.error!)).toBe("already_used_by_other");
  });

  test("an unknown token is not_found", async () => {
    const result = await accept(editor, `no-such-token-${RUN}`);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("IV404");
    expect(result.error?.details).toBe("not_found");
    expect(result.error?.message).toMatch(/not found/i);
    expect(inviteFailureReason(result.error!)).toBe("not_found");
  });

  test("an expired invitation is expired", async () => {
    // A second pending invitation for the editor's address would collide
    // with the unique index, so this one is for a run-specific alias.
    const { token } = await invite(`e2e-expired-${RUN}@example.invalid`, {
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const result = await accept(editor, token);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("IV410");
    expect(result.error?.details).toBe("expired");
    expect(inviteFailureReason(result.error!)).toBe("expired");
  });

  test("an invitation for another address is wrong_email", async () => {
    const { token } = await invite(`e2e-someone-else-${RUN}@example.invalid`);
    const result = await accept(editor, token);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("IV403");
    expect(result.error?.details).toBe("wrong_email");
    expect(result.error?.message).toMatch(/different email/i);
    expect(inviteFailureReason(result.error!)).toBe("wrong_email");
  });
});
