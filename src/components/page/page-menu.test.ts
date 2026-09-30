// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flush, mount, type Mounted } from "@/test/react";

const actions = vi.hoisted(() => ({
  setPagePrivacy: vi.fn(),
  setPageLayout: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/app/actions/pages", () => actions);
vi.mock("@/components/ui/toast", () => toasts);
vi.mock("@/app/actions/reports", () => ({ reportPage: vi.fn() }));
vi.mock("@/app/actions/shares", () => ({ setPublicLink: vi.fn() }));
vi.mock("@/components/page/save-template-dialog", () => ({
  SaveTemplateDialog: () => null,
}));
vi.mock("@/components/page/authorship-dialog", () => ({
  AuthorshipDialog: () => null,
}));

import { PageMenu } from "./page-menu";

// The menu content positions itself with Popper, which watches sizes.
(globalThis as Record<string, unknown>).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  actions.setPagePrivacy.mockReset();
  toasts.toast.mockReset();
});

function menu(props: Partial<Parameters<typeof PageMenu>[0]> = {}) {
  return h(PageMenu, {
    pageId: "p1",
    workspaceId: "w1",
    fullWidth: false,
    smallText: false,
    canEdit: true,
    isPrivate: false,
    canTogglePrivacy: false,
    share: null,
    isPlatformOwner: false,
    ...props,
  });
}

/** Opens the ⋯ menu from the keyboard and returns its items' labels. */
async function openMenu(container: HTMLElement): Promise<string[]> {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Page options"]',
  );
  if (!button) throw new Error("Page options button not found");
  await act(async () => {
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  await flush();
  return Array.from(document.body.querySelectorAll('[role="menuitem"]')).map(
    (item) => item.textContent?.trim() ?? "",
  );
}

function itemNamed(label: string): HTMLElement | null {
  return (
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === label) ?? null
  );
}

describe("PageMenu privacy item", () => {
  it("offers Make private to the page's creator, before the export items", async () => {
    mounted = await mount(menu({ canTogglePrivacy: true }));
    const items = await openMenu(mounted.container);
    expect(items[0]).toBe("Make private");
    expect(items.indexOf("Make private")).toBeLessThan(
      items.indexOf("Markdown"),
    );
  });

  it("offers it to a creator who cannot otherwise edit the page", async () => {
    mounted = await mount(menu({ canTogglePrivacy: true, canEdit: false }));
    const items = await openMenu(mounted.container);
    expect(items).toContain("Make private");
    expect(items).not.toContain("Save as template…");
  });

  it("does not offer it to another editor", async () => {
    mounted = await mount(menu({ canTogglePrivacy: false, canEdit: true }));
    const items = await openMenu(mounted.container);
    expect(items).not.toContain("Make private");
    expect(items).not.toContain("Make shared");
    expect(items).toContain("Save as template…");
  });

  it("reads Make shared when the page is private", async () => {
    mounted = await mount(menu({ canTogglePrivacy: true, isPrivate: true }));
    const items = await openMenu(mounted.container);
    expect(items).toContain("Make shared");
    expect(items).not.toContain("Make private");
  });

  it("shows the action's own sentence when the toggle is refused", async () => {
    actions.setPagePrivacy.mockResolvedValue({
      ok: false,
      error: "Only the page creator can change this.",
    });
    mounted = await mount(menu({ canTogglePrivacy: true }));
    await openMenu(mounted.container);
    const item = itemNamed("Make private");
    if (!item) throw new Error("Make private not found");
    await act(async () => {
      item.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    await flush();
    expect(toasts.toast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Couldn't make the page private",
      description: "Only the page creator can change this.",
    });
  });

  it("toggles privacy through setPagePrivacy", async () => {
    actions.setPagePrivacy.mockResolvedValue({ ok: true });
    mounted = await mount(menu({ canTogglePrivacy: true, isPrivate: true }));
    await openMenu(mounted.container);
    const item = itemNamed("Make shared");
    if (!item) throw new Error("Make shared not found");
    await act(async () => {
      item.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    await flush();
    expect(actions.setPagePrivacy).toHaveBeenCalledWith("p1", false);
  });
});
