// @vitest-environment jsdom
import { createElement as h, useImperativeHandle, useState } from "react";
import type { Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, flush, mount, type Mounted } from "@/test/react";
import type { SuggestionSpan } from "@/components/editor/suggestions";

const actions = vi.hoisted(() => ({ resolveSuggestion: vi.fn() }));
const editorModule = vi.hoisted(() => ({ applyOutcome: vi.fn() }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/app/actions/suggestions", () => actions);
vi.mock("@/app/actions/comments", () => ({ addComment: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => toasts);
vi.mock("@/components/editor/suggestions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/editor/suggestions")>();
  return { ...actual, applyOutcome: editorModule.applyOutcome };
});

import {
  SuggestionChip,
  SuggestionsBar,
  useActiveSuggestion,
  useResolve,
  type ResolveCallbacks,
  type SuggestionActor,
} from "./suggestions-ui";

const ME = "dece6abe-368d-4b07-be5a-df0607190847";
const SAM = "22ec3a42-7542-4dc1-99ad-01a27245095a";
const author: SuggestionActor = {
  userId: ME,
  isAuthor: true,
  isOwner: false,
  members: [
    { id: ME, displayName: "Me" },
    { id: SAM, displayName: "Sam" },
  ],
};

function span(id: string, text = "some text"): SuggestionSpan {
  return {
    id,
    kind: "insertion",
    kinds: new Set(["insertion"]),
    blockLevel: false,
    from: 1,
    to: 1 + text.length,
    text,
  };
}

const editor = {
  prosemirrorView: {
    isDestroyed: false,
    state: { tr: { scrollIntoView: () => ({}) } },
    dispatch: () => {},
    focus: () => {},
  },
} as unknown as Parameters<typeof useResolve>[0];

let mounted: Mounted | null = null;

beforeEach(() => {
  actions.resolveSuggestion.mockReset();
  editorModule.applyOutcome.mockReset().mockReturnValue(true);
  toasts.toast.mockReset();
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

/** Exposes useResolve's `resolve` and `busy` to the test. */
type Handle = {
  resolve: (
    ids: string[],
    outcome: "accepted" | "rejected" | "withdrawn",
  ) => void;
  busy: boolean;
};
function ResolveHarness({
  handle,
  callbacks,
  actor = author,
}: {
  handle: Ref<Handle>;
  callbacks?: ResolveCallbacks;
  actor?: SuggestionActor;
}) {
  const { resolve, busy, reasonDialog } = useResolve(
    editor,
    "page-1",
    actor,
    callbacks,
  );
  useImperativeHandle(handle, () => ({ resolve, busy }));
  return h("div", null, reasonDialog);
}

describe("useResolve", () => {
  it("converges the document to the status the record reports, without a toast", async () => {
    // The suggester withdrew it meanwhile; the reviewer clicks Accept.
    actions.resolveSuggestion.mockResolvedValue({
      ok: true,
      status: "withdrawn",
    });
    const handle: { current: Handle | null } = { current: null };
    const callbacks = {
      onResolving: vi.fn(),
      onResolved: vi.fn(),
      onApplied: vi.fn(),
    };
    mounted = await mount(h(ResolveHarness, { handle, callbacks }));
    handle.current!.resolve(["dece6abe:sugg0001"], "accepted");
    await flush();
    expect(actions.resolveSuggestion).toHaveBeenCalledWith(
      "page-1",
      "dece6abe:sugg0001",
      "accepted",
      undefined,
    );
    expect(callbacks.onResolving).toHaveBeenCalledWith("dece6abe:sugg0001");
    expect(editorModule.applyOutcome).toHaveBeenCalledWith(
      editor,
      "dece6abe:sugg0001",
      "withdrawn",
    );
    expect(callbacks.onResolved).toHaveBeenCalledWith(
      "dece6abe:sugg0001",
      "withdrawn",
      { outcome: "accepted", ownerOverride: false },
    );
    expect(callbacks.onApplied).toHaveBeenCalledWith("dece6abe:sugg0001");
    expect(toasts.toast).not.toHaveBeenCalled();
    expect(handle.current!.busy).toBe(false);
  });

  it("shows the server's own message on a refusal and leaves the document alone", async () => {
    actions.resolveSuggestion.mockResolvedValue({
      ok: false,
      error: "only the page author can resolve suggestions",
    });
    const handle: { current: Handle | null } = { current: null };
    const callbacks = { onResolved: vi.fn(), onApplied: vi.fn() };
    mounted = await mount(h(ResolveHarness, { handle, callbacks }));
    handle.current!.resolve(["dece6abe:sugg0001"], "rejected");
    await flush();
    expect(editorModule.applyOutcome).not.toHaveBeenCalled();
    expect(callbacks.onResolved).not.toHaveBeenCalled();
    expect(toasts.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Could not resolve suggestion",
        description: "only the page author can resolve suggestions",
      }),
    );
    expect(handle.current!.busy).toBe(false);
  });

  it("continues past a failure when resolving several, with one summary", async () => {
    actions.resolveSuggestion
      .mockResolvedValueOnce({ ok: true, status: "accepted" })
      .mockResolvedValueOnce({ ok: false, error: "context changed" })
      .mockResolvedValueOnce({ ok: true, status: "accepted" });
    const handle: { current: Handle | null } = { current: null };
    mounted = await mount(h(ResolveHarness, { handle }));
    handle.current!.resolve(["a:1", "a:2", "a:3"], "accepted");
    await flush();
    expect(actions.resolveSuggestion).toHaveBeenCalledTimes(3);
    expect(editorModule.applyOutcome.mock.calls.map((c) => c[1])).toEqual([
      "a:1",
      "a:3",
    ]);
    expect(toasts.toast).toHaveBeenCalledTimes(1);
    expect(toasts.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "1 of 3 could not be resolved",
        description: "context changed",
      }),
    );
  });

  it("summarises a fully successful batch", async () => {
    actions.resolveSuggestion.mockResolvedValue({
      ok: true,
      status: "rejected",
    });
    const handle: { current: Handle | null } = { current: null };
    mounted = await mount(h(ResolveHarness, { handle }));
    handle.current!.resolve(["a:1", "a:2"], "rejected");
    await flush();
    expect(toasts.toast).toHaveBeenCalledTimes(1);
    expect(toasts.toast).toHaveBeenCalledWith({
      title: "2 suggestions rejected",
    });
  });
});

/** Holds spans in state and shows the chip for the active one. */
function ChipHarness({
  handle,
}: {
  handle: Ref<{
    setSpans: (s: SuggestionSpan[]) => void;
    activate: (s: SuggestionSpan) => void;
  }>;
}) {
  const [spans, setSpans] = useState<SuggestionSpan[]>([
    span("dece6abe:sugg0001"),
  ]);
  const [active, setActive] = useActiveSuggestion(spans);
  useImperativeHandle(handle, () => ({
    setSpans,
    activate: (s) => setActive({ span: s, position: { left: 0, top: 0 } }),
  }));
  return active
    ? h(SuggestionChip, {
        editor,
        pageId: "page-1",
        actor: author,
        span: active.span,
        position: active.position,
      })
    : null;
}

describe("SuggestionChip", () => {
  it("unmounts the moment its span leaves the document", async () => {
    const handle: {
      current: Parameters<typeof ChipHarness>[0]["handle"] extends Ref<infer T>
        ? T | null
        : never;
    } = { current: null };
    mounted = await mount(h(ChipHarness, { handle }));
    handle.current!.activate(span("dece6abe:sugg0001"));
    await flush();
    expect(
      mounted.container.querySelector("[data-suggestion-chip]"),
    ).not.toBeNull();
    // The suggestion is resolved elsewhere; the caret has not moved.
    handle.current!.setSpans([]);
    await flush();
    expect(
      mounted.container.querySelector("[data-suggestion-chip]"),
    ).toBeNull();
  });
});

/** The bar over spans it owns; a resolution removes the span as the
 *  document would once the marks are gone. */
function BarHarness({
  initial,
  actor = author,
}: {
  initial: SuggestionSpan[];
  actor?: SuggestionActor;
}) {
  const [spans, setSpans] = useState(initial);
  return h(SuggestionsBar, {
    editor,
    workspaceId: "w1",
    pageId: "page-1",
    actor,
    spans,
    threads: {},
    meta: {
      "22ec3a42:sugg0001": {
        suggesterId: SAM,
        createdAt: "2026-09-30T08:00:00Z",
      },
    },
    callbacks: {
      onApplied: (id) =>
        setSpans((list) => list.filter((item) => item.id !== id)),
    },
  });
}

function rowButtons(container: HTMLElement, id: string) {
  const row = container.querySelector(`[data-suggestion-row="${id}"]`);
  return Array.from(row?.querySelectorAll("button") ?? []);
}

describe("SuggestionsBar review list", () => {
  async function open(container: HTMLElement) {
    const review = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Review",
    );
    await click(review ?? null);
  }

  it("removes a row when its resolution succeeds", async () => {
    actions.resolveSuggestion.mockResolvedValue({
      ok: true,
      status: "accepted",
    });
    mounted = await mount(
      h(BarHarness, {
        initial: [
          span("22ec3a42:sugg0001", "one"),
          span("22ec3a42:sugg0002", "two"),
        ],
      }),
    );
    await open(mounted.container);
    expect(mounted.container.textContent).toContain("2 open suggestions");
    expect(mounted.container.textContent).toContain("Sam");
    const accept = rowButtons(mounted.container, "22ec3a42:sugg0001").find(
      (b) => b.textContent?.includes("Accept"),
    );
    await click(accept ?? null);
    expect(
      mounted.container.querySelector(
        '[data-suggestion-row="22ec3a42:sugg0001"]',
      ),
    ).toBeNull();
    expect(
      mounted.container.querySelector(
        '[data-suggestion-row="22ec3a42:sugg0002"]',
      ),
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("1 open suggestion");
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("keeps the row and re-enables its buttons when the record refuses", async () => {
    actions.resolveSuggestion.mockResolvedValue({
      ok: false,
      error: "context changed: this suggestion can no longer be applied",
    });
    mounted = await mount(
      h(BarHarness, { initial: [span("22ec3a42:sugg0001")] }),
    );
    await open(mounted.container);
    const accept = rowButtons(mounted.container, "22ec3a42:sugg0001").find(
      (b) => b.textContent?.includes("Accept"),
    );
    await click(accept ?? null);
    const row = mounted.container.querySelector(
      '[data-suggestion-row="22ec3a42:sugg0001"]',
    );
    expect(row).not.toBeNull();
    for (const button of rowButtons(mounted.container, "22ec3a42:sugg0001")) {
      expect(button.disabled).toBe(false);
    }
    expect(toasts.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description:
          "context changed: this suggestion can no longer be applied",
      }),
    );
  });

  it("offers Withdraw, not Accept, to a suggester who is not the author", async () => {
    const suggester: SuggestionActor = {
      ...author,
      userId: SAM,
      isAuthor: false,
    };
    mounted = await mount(
      h(BarHarness, { initial: [span("22ec3a42:sugg0001")], actor: suggester }),
    );
    await open(mounted.container);
    const labels = rowButtons(mounted.container, "22ec3a42:sugg0001").map((b) =>
      b.textContent?.trim(),
    );
    expect(labels.some((l) => l?.includes("Withdraw"))).toBe(true);
    expect(labels.some((l) => l?.includes("Accept"))).toBe(false);
    expect(mounted.container.textContent).not.toContain("Accept all");
  });
});
