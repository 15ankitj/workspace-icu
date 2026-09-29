// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buttonNamed, click, mount, type Mounted } from "@/test/react";

const passkeys = vi.hoisted(() => ({
  isSupported: vi.fn(),
  list: vi.fn(),
  register: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  MAX_PASSKEY_NAME_LENGTH: 120,
}));
const actions = vi.hoisted(() => ({
  recordPasskeyRegistered: vi.fn(),
  recordPasskeyRemoved: vi.fn(),
}));
vi.mock("@/lib/passkeys", () => passkeys);
vi.mock("@/app/actions/passkeys", () => actions);

import { PasskeysBlock } from "./passkeys-block";

let mounted: Mounted | null = null;

beforeEach(() => {
  passkeys.isSupported.mockReset().mockReturnValue(true);
  passkeys.list.mockReset().mockResolvedValue([
    {
      id: "k1",
      name: "Work laptop",
      createdAt: "2026-01-05T10:00:00Z",
      lastUsedAt: "2026-02-10T10:00:00Z",
    },
    {
      id: "k2",
      name: "Phone",
      createdAt: "2026-01-06T10:00:00Z",
      lastUsedAt: null,
    },
  ]);
  passkeys.register.mockReset();
  passkeys.rename.mockReset();
  passkeys.remove.mockReset();
  actions.recordPasskeyRegistered.mockReset().mockResolvedValue(undefined);
  actions.recordPasskeyRemoved.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("PasskeysBlock", () => {
  it("renders nothing when the flag is off", async () => {
    mounted = await mount(h(PasskeysBlock, { enabled: false }));
    expect(mounted.container.innerHTML).toBe("");
    expect(passkeys.list).not.toHaveBeenCalled();
  });

  it("shows one line when the browser lacks WebAuthn", async () => {
    passkeys.isSupported.mockReturnValue(false);
    mounted = await mount(h(PasskeysBlock, { enabled: true }));
    expect(mounted.container.textContent).toContain(
      "Passkeys aren't available in this browser.",
    );
    expect(buttonNamed(mounted.container, "Add a passkey")).toBeNull();
    expect(passkeys.list).not.toHaveBeenCalled();
  });

  it("lists each passkey with its name, created date and last use", async () => {
    mounted = await mount(h(PasskeysBlock, { enabled: true }));
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Work laptop");
    expect(text).toContain("Added 5 Jan 2026");
    expect(text).toContain("Last used 10 Feb 2026");
    expect(text).toContain("Phone");
    expect(text).toContain("Last used never");
    expect(buttonNamed(mounted.container, "Add a passkey")).not.toBeNull();
  });

  it("adds a passkey and records it", async () => {
    passkeys.register.mockResolvedValue({
      id: "k3",
      name: "1Password",
      createdAt: "2026-03-01T10:00:00Z",
      lastUsedAt: null,
    });
    mounted = await mount(h(PasskeysBlock, { enabled: true }));
    await click(buttonNamed(mounted.container, "Add a passkey"));
    expect(mounted.container.textContent).toContain("1Password");
    expect(actions.recordPasskeyRegistered).toHaveBeenCalledWith(
      "k3",
      "1Password",
    );
  });

  it("renames inline", async () => {
    passkeys.rename.mockResolvedValue({
      id: "k2",
      name: "Pixel",
      createdAt: "2026-01-06T10:00:00Z",
      lastUsedAt: null,
    });
    mounted = await mount(h(PasskeysBlock, { enabled: true }));
    const renameButtons = Array.from(
      mounted.container.querySelectorAll("button"),
    ).filter((b) => b.textContent === "Rename");
    await click(renameButtons[1]);
    const input = mounted.container.querySelector<HTMLInputElement>(
      'input[type="text"], input:not([type])',
    )!;
    expect(input.value).toBe("Phone");
    await click(buttonNamed(mounted.container, "Save"));
    expect(passkeys.rename).toHaveBeenCalledWith("k2", "Phone");
    expect(mounted.container.textContent).toContain("Pixel");
    expect(mounted.container.textContent).not.toContain("Phone");
  });

  it("removes only after confirmation, then records it", async () => {
    passkeys.remove.mockResolvedValue(undefined);
    mounted = await mount(h(PasskeysBlock, { enabled: true }));
    const removeButtons = Array.from(
      mounted.container.querySelectorAll("button"),
    ).filter((b) => b.textContent === "Remove");
    await click(removeButtons[0]);
    expect(passkeys.remove).not.toHaveBeenCalled();
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent === "Remove passkey",
    );
    expect(confirm).toBeDefined();
    await click(confirm!);
    expect(passkeys.remove).toHaveBeenCalledWith("k1");
    expect(actions.recordPasskeyRemoved).toHaveBeenCalledWith(
      "k1",
      "Work laptop",
    );
    expect(mounted.container.textContent).not.toContain("Work laptop");
    expect(mounted.container.textContent).toContain("Phone");
  });
});
