// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flush, mount, type Mounted } from "@/test/react";
import { ActionForm } from "./action-form";

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

async function submit(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("form not rendered");
  await act(async () => {
    form.requestSubmit();
  });
  await flush();
}

describe("ActionForm", () => {
  it("renders the action's failure sentence inline", async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: "You cannot change your own role.",
    }));
    mounted = await mount(
      h(
        ActionForm,
        { action, className: "flex" },
        h("input", { name: "role", defaultValue: "viewer" }),
        h("button", { type: "submit" }, "Update"),
      ),
    );
    expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
    await submit(mounted.container);
    expect(action).toHaveBeenCalledTimes(1);
    const [state, formData] = action.mock.calls[0] as unknown as [
      unknown,
      FormData,
    ];
    expect(state).toBeNull();
    expect(formData.get("role")).toBe("viewer");
    expect(mounted.container.querySelector('[role="alert"]')?.textContent).toBe(
      "You cannot change your own role.",
    );
  });

  it("shows nothing on success", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    mounted = await mount(
      h(ActionForm, { action }, h("button", { type: "submit" }, "Go")),
    );
    await submit(mounted.container);
    expect(action).toHaveBeenCalledTimes(1);
    expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
  });
});
