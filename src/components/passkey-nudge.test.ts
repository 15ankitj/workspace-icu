// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buttonNamed, click, flush, mount, type Mounted } from "@/test/react";

const passkeys = vi.hoisted(() => ({
  isSupported: vi.fn(),
  list: vi.fn(),
  register: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  dismissPasskeyNudge: vi.fn(),
  recordPasskeyRegistered: vi.fn(),
}));
vi.mock("@/lib/passkeys", () => passkeys);
vi.mock("@/app/actions/passkeys", () => actions);

import { PasskeyNudge } from "./passkey-nudge";

let mounted: Mounted | null = null;

beforeEach(() => {
  passkeys.isSupported.mockReset().mockReturnValue(true);
  passkeys.list.mockReset().mockResolvedValue([]);
  passkeys.register.mockReset();
  actions.dismissPasskeyNudge.mockReset().mockResolvedValue(undefined);
  actions.recordPasskeyRegistered.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

const TITLE = "Sign in faster next time";

describe("PasskeyNudge visibility", () => {
  it("shows when the flag is on, not dismissed, supported and no passkey exists", async () => {
    mounted = await mount(h(PasskeyNudge, { show: true }));
    expect(mounted.container.textContent).toContain(TITLE);
    expect(mounted.container.textContent).toContain(
      "You can always still sign in by email.",
    );
    expect(buttonNamed(mounted.container, "Add a passkey")).not.toBeNull();
    expect(buttonNamed(mounted.container, "Not now")).not.toBeNull();
  });

  it("stays hidden when the server says not to show it (flag off or dismissed)", async () => {
    mounted = await mount(h(PasskeyNudge, { show: false }));
    expect(mounted.container.textContent).toBe("");
    expect(passkeys.list).not.toHaveBeenCalled();
  });

  it("stays hidden when the browser lacks WebAuthn", async () => {
    passkeys.isSupported.mockReturnValue(false);
    mounted = await mount(h(PasskeyNudge, { show: true }));
    expect(mounted.container.textContent).toBe("");
    expect(passkeys.list).not.toHaveBeenCalled();
  });

  it("stays hidden when the user already has a passkey", async () => {
    passkeys.list.mockResolvedValue([
      { id: "k1", name: "Phone", createdAt: "2026-01-01", lastUsedAt: null },
    ]);
    mounted = await mount(h(PasskeyNudge, { show: true }));
    expect(mounted.container.textContent).toBe("");
  });

  it("checks the passkey list once, not on re-render", async () => {
    mounted = await mount(h(PasskeyNudge, { show: true }));
    await mounted.rerender(h(PasskeyNudge, { show: true }));
    await mounted.rerender(h(PasskeyNudge, { show: true }));
    expect(passkeys.list).toHaveBeenCalledTimes(1);
  });
});

describe("PasskeyNudge actions", () => {
  it("hides at once on Not now and stamps the row in the background", async () => {
    let resolveDismiss: () => void = () => {};
    actions.dismissPasskeyNudge.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDismiss = resolve;
      }),
    );
    mounted = await mount(h(PasskeyNudge, { show: true }));
    await click(buttonNamed(mounted.container, "Not now"));
    expect(mounted.container.textContent).toBe("");
    expect(actions.dismissPasskeyNudge).toHaveBeenCalledTimes(1);
    resolveDismiss();
    await flush();
  });

  it("confirms with the friendly name after a successful add and records it", async () => {
    passkeys.register.mockResolvedValue({
      id: "k1",
      name: "iCloud Keychain",
      createdAt: "2026-01-01",
      lastUsedAt: null,
    });
    mounted = await mount(h(PasskeyNudge, { show: true }));
    await click(buttonNamed(mounted.container, "Add a passkey"));
    expect(mounted.container.textContent).toContain(
      "Passkey added: iCloud Keychain",
    );
    expect(actions.recordPasskeyRegistered).toHaveBeenCalledWith(
      "k1",
      "iCloud Keychain",
    );
    expect(actions.dismissPasskeyNudge).toHaveBeenCalledTimes(1);
    await click(buttonNamed(mounted.container, "Done"));
    expect(mounted.container.textContent).toBe("");
  });

  it("keeps offering, silently, when the user cancels the prompt", async () => {
    passkeys.register.mockResolvedValue(null);
    mounted = await mount(h(PasskeyNudge, { show: true }));
    await click(buttonNamed(mounted.container, "Add a passkey"));
    expect(mounted.container.textContent).toContain(TITLE);
    expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
    expect(actions.recordPasskeyRegistered).not.toHaveBeenCalled();
    expect(actions.dismissPasskeyNudge).not.toHaveBeenCalled();
  });

  it("shows other errors in the card", async () => {
    passkeys.register.mockRejectedValue(new Error("Too many passkeys"));
    mounted = await mount(h(PasskeyNudge, { show: true }));
    await click(buttonNamed(mounted.container, "Add a passkey"));
    expect(mounted.container.querySelector('[role="alert"]')?.textContent).toBe(
      "Too many passkeys",
    );
  });
});
