import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const rpc = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      expect(table).toBe("audit_events");
      return { insert };
    },
    rpc,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  // runAction rethrows Next.js control flow; the mock's redirect is a
  // plain Error, so recognise it by its message here.
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("redirect:")) {
      throw error;
    }
  },
}));

import {
  dismissPasskeyNudge,
  recordPasskeyRegistered,
  recordPasskeyRemoved,
} from "./passkeys";

const PASSKEY_ID = "0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b";

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("passkey audit actions", () => {
  it("writes the registered row as the actor with no workspace", async () => {
    await recordPasskeyRegistered(PASSKEY_ID, "Work laptop");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      actor_id: "user-1",
      workspace_id: null,
      event_type: "passkey_registered",
      target_type: "passkey",
      target_id: PASSKEY_ID,
      metadata: { friendly_name: "Work laptop" },
    });
  });

  it("writes the removed row with only the friendly name as metadata", async () => {
    await recordPasskeyRemoved(PASSKEY_ID, "  Phone  ");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "passkey_removed",
        target_type: "passkey",
        target_id: PASSKEY_ID,
        metadata: { friendly_name: "Phone" },
      }),
    );
  });

  it("falls back to a generic name and caps its length", async () => {
    await recordPasskeyRegistered(PASSKEY_ID, "");
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ metadata: { friendly_name: "Passkey" } }),
    );
    await recordPasskeyRegistered(PASSKEY_ID, "x".repeat(200));
    const row = insert.mock.calls.at(-1)![0] as {
      metadata: { friendly_name: string };
    };
    expect(row.metadata.friendly_name).toHaveLength(120);
  });

  it("rejects a malformed passkey id before touching the database", async () => {
    await expect(recordPasskeyRegistered("not-a-uuid", "x")).resolves.toEqual({
      ok: false,
      error: "Invalid passkey id.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("sends a signed-out caller to sign in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(recordPasskeyRegistered(PASSKEY_ID, "x")).rejects.toThrow(
      "redirect:/sign-in",
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns an insert failure as a result, never a throw", async () => {
    insert.mockResolvedValue({
      error: { code: "42501", message: "permission denied for table x" },
    });
    await expect(recordPasskeyRegistered(PASSKEY_ID, "x")).resolves.toEqual({
      ok: false,
      error: "You don't have permission to do that.",
      code: "permission_denied",
    });
  });
});

describe("dismissPasskeyNudge", () => {
  it("calls the RPC on the caller's own row", async () => {
    await dismissPasskeyNudge();
    expect(rpc).toHaveBeenCalledWith("dismiss_passkey_nudge");
  });

  it("returns an RPC failure as a result", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "nope" } });
    await expect(dismissPasskeyNudge()).resolves.toEqual({
      ok: false,
      error: "Nope.",
      code: "refused",
    });
  });
});
