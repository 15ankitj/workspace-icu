import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

/**
 * Minimal helpers for rendering client components in jsdom tests without
 * a testing library: mount, re-render, flush effects and promises, unmount.
 */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export type Mounted = {
  container: HTMLElement;
  rerender: (element: ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
};

export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  await flush();
  return {
    container,
    rerender: async (next) => {
      await act(async () => {
        root.render(next);
      });
      await flush();
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Lets pending promises and the effects they trigger settle. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

export async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error("click target not found");
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
}

export function buttonNamed(
  container: HTMLElement,
  name: string,
): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === name,
    ) ?? null
  );
}
