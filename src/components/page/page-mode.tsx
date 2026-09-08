"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Eye, MessageSquarePlus, Pencil } from "lucide-react";
import {
  allowedPageModes,
  defaultPageMode,
  type PageMode,
} from "@/lib/suggestions";
import { cn } from "@/lib/utils";

interface PageModeValue {
  mode: PageMode;
  setMode: (mode: PageMode) => void;
  allowed: PageMode[];
  /** Open suggestions on the page, kept current by the editor. */
  pending: number;
  setPending: (count: number) => void;
}

const PageModeContext = createContext<PageModeValue>({
  mode: "view",
  setMode: () => {},
  allowed: ["view"],
  pending: 0,
  setPending: () => {},
});

export function usePageMode() {
  return useContext(PageModeContext);
}

/**
 * Edit / Suggest / View for this user on this page (Appendix A §2.2).
 * Non-authors of authored pages land in Suggest and cannot pick Edit;
 * anyone who can edit may choose Suggest. Suggesting needs the
 * collaborative document, so without collaboration configured the
 * choice is Edit or View.
 */
export function PageModeProvider({
  canEdit,
  authored,
  isAuthor,
  suggestionsAvailable,
  children,
}: {
  canEdit: boolean;
  authored: boolean;
  isAuthor: boolean;
  suggestionsAvailable: boolean;
  children: React.ReactNode;
}) {
  const allowed = useMemo(
    () =>
      allowedPageModes({ canEdit, authored, isAuthor, suggestionsAvailable }),
    [canEdit, authored, isAuthor, suggestionsAvailable],
  );
  const [mode, setModeState] = useState<PageMode>(() =>
    defaultPageMode({ canEdit, authored, isAuthor, suggestionsAvailable }),
  );
  const [pending, setPending] = useState(0);
  const value = useMemo<PageModeValue>(
    () => ({
      mode: allowed.includes(mode) ? mode : allowed[0],
      setMode: (next) => {
        if (allowed.includes(next)) setModeState(next);
      },
      allowed,
      pending,
      setPending,
    }),
    [mode, allowed, pending],
  );
  return (
    <PageModeContext.Provider value={value}>
      {children}
    </PageModeContext.Provider>
  );
}

const LABELS: Record<
  PageMode,
  { label: string; icon: typeof Pencil; title: string }
> = {
  edit: { label: "Edit", icon: Pencil, title: "Change the page directly" },
  suggest: {
    label: "Suggest",
    icon: MessageSquarePlus,
    title: "Propose changes for the author to accept or reject",
  },
  view: { label: "View", icon: Eye, title: "Read without changing anything" },
};

/** The segmented mode control shown in the page header. */
export function PageModeToggle() {
  const { mode, setMode, allowed, pending } = usePageMode();
  if (allowed.length <= 1 && pending === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Page mode"
      className="inline-flex h-7 items-center rounded-md border p-0.5 text-xs"
    >
      {allowed.map((m) => {
        const { label, icon: Icon, title } = LABELS[m];
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            onClick={() => setMode(m)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
            {m === "suggest" && pending > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-600/15 px-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                {pending}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
