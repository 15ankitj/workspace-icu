"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
 * Wraps a page's title, details and body editors so all of them report
 * into one place. A successful save lets the top bar say "Edited just now
 * · You"; a failed save raises a toast with a Retry, and that toast is the
 * only failure surface — there is no separate indicator.
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
