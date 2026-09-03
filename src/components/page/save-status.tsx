"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveStatusValue {
  state: SaveState;
  retry: (() => void) | null;
  report: (state: SaveState, retry?: () => void) => void;
}

const SaveStatusContext = createContext<SaveStatusValue>({
  state: "idle",
  retry: null,
  report: () => {},
});

/**
 * Wraps a page's title and body editors so both report into one visible
 * status. A failed save also raises a toast, because the indicator is
 * small and the user may have scrolled past it.
 */
export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<{
    state: SaveState;
    retry: (() => void) | null;
  }>({ state: "idle", retry: null });

  const report = useCallback((next: SaveState, retry?: () => void) => {
    setStatus({ state: next, retry: retry ?? null });
    if (next === "error") {
      toast({
        variant: "destructive",
        title: "Couldn't save your changes",
        description:
          "Your edits are still on this page. Check your connection and retry.",
        action: retry ? { label: "Retry", onClick: retry } : undefined,
      });
    }
  }, []);

  const value = useMemo(
    () => ({ state: status.state, retry: status.retry, report }),
    [status, report],
  );

  return (
    <SaveStatusContext.Provider value={value}>
      {children}
    </SaveStatusContext.Provider>
  );
}

export function useSaveStatus() {
  return useContext(SaveStatusContext);
}

/** "Saving…" / "Saved" / "Couldn't save · Retry", for the page top bar. */
export function SaveStatusIndicator() {
  const { state, retry } = useSaveStatus();
  if (state === "idle") return null;

  if (state === "error") {
    return (
      <span
        role="status"
        className="flex items-center gap-1.5 text-xs text-destructive"
      >
        <AlertCircle className="size-3.5" aria-hidden />
        Couldn&apos;t save
        {retry && (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              onClick={retry}
            >
              Retry
            </button>
          </>
        )}
      </span>
    );
  }

  return (
    <span
      role="status"
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        <>
          <Check className="size-3.5" aria-hidden />
          Saved
        </>
      )}
    </span>
  );
}
