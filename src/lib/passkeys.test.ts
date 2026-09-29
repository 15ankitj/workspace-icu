import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  registerPasskey: vi.fn(),
  signInWithPasskey: vi.fn(),
  passkey: { list: vi.fn(), update: vi.fn(), delete: vi.fn() },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth }),
}));

import {
  isSupported,
  list,
  register,
  remove,
  rename,
  signIn,
} from "@/lib/passkeys";

/** What supabase-js returns when the user closes the browser prompt. */
const dismissed = {
  message: "The operation either timed out or was not allowed.",
  code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
  cause: { name: "NotAllowedError" },
};
const aborted = { message: "aborted", code: "ERROR_CEREMONY_ABORTED" };
const failure = { message: "Passkey sign-in is not enabled", code: "x" };

beforeEach(() => {
  for (const fn of [
    auth.registerPasskey,
    auth.signInWithPasskey,
    auth.passkey.list,
    auth.passkey.update,
    auth.passkey.delete,
  ]) {
    fn.mockReset();
  }
});

describe("isSupported", () => {
  it("is false without a browser", () => {
    expect(isSupported()).toBe(false);
  });
});

describe("register", () => {
  it("maps the passkey and falls back to a generic name", async () => {
    auth.registerPasskey.mockResolvedValue({
      data: { id: "k1", created_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    await expect(register()).resolves.toEqual({
      id: "k1",
      name: "Passkey",
      createdAt: "2026-01-01T00:00:00Z",
      lastUsedAt: null,
    });
    expect(auth.registerPasskey).toHaveBeenCalledTimes(1);
  });

  it("keeps the authenticator's friendly name", async () => {
    auth.registerPasskey.mockResolvedValue({
      data: {
        id: "k1",
        friendly_name: " iCloud Keychain ",
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
    await expect(register()).resolves.toMatchObject({
      name: "iCloud Keychain",
    });
  });

  it("returns null, not an error, when the user cancels", async () => {
    auth.registerPasskey.mockResolvedValue({ data: null, error: dismissed });
    await expect(register()).resolves.toBeNull();
    auth.registerPasskey.mockResolvedValue({ data: null, error: aborted });
    await expect(register()).resolves.toBeNull();
  });

  it("propagates every other error with its message", async () => {
    auth.registerPasskey.mockResolvedValue({ data: null, error: failure });
    await expect(register()).rejects.toThrow("Passkey sign-in is not enabled");
  });
});

describe("signIn", () => {
  it("is true once a session exists", async () => {
    auth.signInWithPasskey.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u" } },
      error: null,
    });
    await expect(signIn()).resolves.toBe(true);
  });

  it("is false when the user cancels", async () => {
    auth.signInWithPasskey.mockResolvedValue({ data: null, error: dismissed });
    await expect(signIn()).resolves.toBe(false);
  });

  it("throws on failure and on a missing session", async () => {
    auth.signInWithPasskey.mockResolvedValue({ data: null, error: failure });
    await expect(signIn()).rejects.toThrow("Passkey sign-in is not enabled");
    auth.signInWithPasskey.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    await expect(signIn()).rejects.toThrow(/did not complete/);
  });
});

describe("list, rename, remove", () => {
  it("lists with last-used dates", async () => {
    auth.passkey.list.mockResolvedValue({
      data: [
        {
          id: "k1",
          friendly_name: "Work laptop",
          created_at: "2026-01-01T00:00:00Z",
          last_used_at: "2026-02-01T00:00:00Z",
        },
      ],
      error: null,
    });
    await expect(list()).resolves.toEqual([
      {
        id: "k1",
        name: "Work laptop",
        createdAt: "2026-01-01T00:00:00Z",
        lastUsedAt: "2026-02-01T00:00:00Z",
      },
    ]);
  });

  it("renames with a trimmed name and refuses an empty one", async () => {
    auth.passkey.update.mockResolvedValue({
      data: { id: "k1", friendly_name: "Phone", created_at: "2026-01-01" },
      error: null,
    });
    await expect(rename("k1", "  Phone ")).resolves.toMatchObject({
      name: "Phone",
    });
    expect(auth.passkey.update).toHaveBeenCalledWith({
      passkeyId: "k1",
      friendlyName: "Phone",
    });
    await expect(rename("k1", "   ")).rejects.toThrow(/Enter a name/);
  });

  it("removes and propagates errors", async () => {
    auth.passkey.delete.mockResolvedValue({ data: null, error: null });
    await expect(remove("k1")).resolves.toBeUndefined();
    expect(auth.passkey.delete).toHaveBeenCalledWith({ passkeyId: "k1" });
    auth.passkey.delete.mockResolvedValue({ data: null, error: failure });
    await expect(remove("k1")).rejects.toThrow(
      "Passkey sign-in is not enabled",
    );
  });
});
