"use client";

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { renamePage, setPageIcon } from "@/app/actions/pages";
import { Badge } from "@/components/ui/badge";
import { useSaveStatus } from "@/components/page/save-status";

const SAVE_DEBOUNCE_MS = 600;

const fieldClass =
  "-mx-1 rounded-md bg-transparent px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:cursor-default placeholder:text-muted-foreground";

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
  const { report } = useSaveStatus();
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(label: string, action: () => Promise<unknown>) {
    const attempt = () => {
      report("saving");
      action()
        .then(() => report("saved"))
        .catch((error) => {
          console.error(`Failed to save ${label}:`, error);
          report("error", attempt);
        });
    };
    attempt();
  }

  function scheduleTitle(nextTitle: string) {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(
      () => persist("title", () => renamePage(pageId, nextTitle)),
      SAVE_DEBOUNCE_MS,
    );
  }

  function scheduleIcon(nextIcon: string) {
    if (iconTimer.current) clearTimeout(iconTimer.current);
    iconTimer.current = setTimeout(
      () => persist("icon", () => setPageIcon(pageId, nextIcon || null)),
      SAVE_DEBOUNCE_MS,
    );
  }

  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={icon}
          readOnly={!canEdit}
          onChange={(e) => {
            const next = e.target.value.slice(-2);
            setIcon(next);
            scheduleIcon(next);
          }}
          placeholder="📄"
          aria-label="Page icon (emoji)"
          className={`${fieldClass} w-12 text-center text-4xl`}
        />
        {isPrivate && (
          <Badge variant="muted">
            <Lock className="size-3" aria-hidden /> Private
          </Badge>
        )}
      </div>
      <input
        type="text"
        value={title}
        readOnly={!canEdit}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleTitle(e.target.value);
        }}
        onBlur={() => {
          if (!canEdit || title === initialTitle) return;
          if (titleTimer.current) clearTimeout(titleTimer.current);
          persist("title", () => renamePage(pageId, title));
        }}
        placeholder="Untitled"
        aria-label="Page title"
        className={`${fieldClass} w-full text-4xl font-bold tracking-tight`}
      />
    </header>
  );
}
