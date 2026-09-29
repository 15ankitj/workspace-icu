// @vitest-environment jsdom
import { createElement as h } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buttonNamed, click, mount, type Mounted } from "@/test/react";

const passkeys = vi.hoisted(() => ({ isSupported: vi.fn(), signIn: vi.fn() }));
vi.mock("@/lib/passkeys", () => passkeys);
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() },
  }),
}));

import { SignInForm } from "./sign-in-form";

const PASSKEY = "Sign in with a passkey";

/** The "or" between the email form and the passkey button. */
function separator(container: HTMLElement): Element | null {
  return (
    Array.from(container.querySelectorAll("span")).find(
      (span) => span.textContent === "or",
    ) ?? null
  );
}
let mounted: Mounted | null = null;

beforeEach(() => {
  passkeys.isSupported.mockReset().mockReturnValue(true);
  passkeys.signIn.mockReset();
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("SignInForm passkey button", () => {
  it("is absent when the flag is off, even in a capable browser", async () => {
    mounted = await mount(h(SignInForm, { passkeysEnabled: false }));
    expect(buttonNamed(mounted.container, PASSKEY)).toBeNull();
    expect(separator(mounted.container)).toBeNull();
    expect(
      buttonNamed(mounted.container, "Continue with email"),
    ).not.toBeNull();
  });

  it("is absent when the browser lacks WebAuthn", async () => {
    passkeys.isSupported.mockReturnValue(false);
    mounted = await mount(h(SignInForm, { passkeysEnabled: true }));
    expect(buttonNamed(mounted.container, PASSKEY)).toBeNull();
  });

  it("appears below the email form with the separator when flag on and supported", async () => {
    mounted = await mount(h(SignInForm, { passkeysEnabled: true }));
    const button = buttonNamed(mounted.container, PASSKEY);
    expect(button).not.toBeNull();
    expect(separator(mounted.container)).not.toBeNull();
    const email = buttonNamed(mounted.container, "Continue with email")!;
    expect(
      email.compareDocumentPosition(button!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("is not gated by the acceptable-use checkbox", async () => {
    passkeys.signIn.mockResolvedValue(false);
    mounted = await mount(h(SignInForm, { passkeysEnabled: true }));
    const checkbox = mounted.container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkbox?.checked).toBe(false);
    await click(buttonNamed(mounted.container, PASSKEY));
    expect(passkeys.signIn).toHaveBeenCalledTimes(1);
  });

  it("says nothing when the user cancels, and shows other errors", async () => {
    passkeys.signIn.mockResolvedValue(false);
    mounted = await mount(h(SignInForm, { passkeysEnabled: true }));
    await click(buttonNamed(mounted.container, PASSKEY));
    expect(mounted.container.querySelector('[role="alert"]')).toBeNull();

    passkeys.signIn.mockRejectedValue(
      new Error("Passkey sign-in is not enabled"),
    );
    await click(buttonNamed(mounted.container, PASSKEY));
    expect(mounted.container.querySelector('[role="alert"]')?.textContent).toBe(
      "Passkey sign-in is not enabled",
    );
  });
});
