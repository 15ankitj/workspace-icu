"use client";

import { useRef, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { renamePage, setPageIcon } from "@/app/actions/pages";

/** Editable title + icon. Saves on blur and debounced while typing. */
export function PageHeader({
  pageId,
  initialTitle,
  initialIcon,
  isPrivate,
  canEdit,
}: {
  pageId: string;
  initialTitle: string;
  initialIcon: string | null;
  isPrivate: boolean;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon ?? "");
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(nextTitle: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      startTransition(() => renamePage(pageId, nextTitle));
    }, 600);
  }

  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={icon}
          disabled={!canEdit}
          onChange={(e) => {
            const next = e.target.value.slice(-2);
            setIcon(next);
            startTransition(() => setPageIcon(pageId, next || null));
          }}
          placeholder="📄"
          aria-label="Page icon (emoji)"
          className="w-12 bg-transparent text-center text-4xl focus:outline-none disabled:opacity-100"
        />
        {isPrivate && (
          <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Lock className="size-3" /> Private
          </span>
        )}
      </div>
      <input
        type="text"
        value={title}
        disabled={!canEdit}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value);
        }}
        onBlur={() => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          startTransition(() => renamePage(pageId, title));
        }}
        placeholder="Untitled"
        aria-label="Page title"
        className="w-full bg-transparent text-4xl font-bold placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-100"
      />
    </header>
  );
}
