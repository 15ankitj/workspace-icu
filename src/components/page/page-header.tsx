"use client";

import { useRef, useState } from "react";
import { AlignLeft, Lock } from "lucide-react";
import {
  renamePage,
  setPageDescription,
  setPageIcon,
} from "@/app/actions/pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaveStatus } from "@/components/page/save-status";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 600;

const fieldClass =
  "-mx-1 rounded-md bg-transparent px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:cursor-default placeholder:text-muted-foreground";

/**
 * Editable icon, title and one-line description. Saves on blur and
 * debounced while typing. The quiet "Add cover / Add description" row
 * above the title appears on hover or focus, and always on touch screens.
 */
export function PageHeader({
  pageId,
  initialTitle,
  initialIcon,
  initialDescription,
  isPrivate,
  canEdit,
  addCover,
}: {
  pageId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialDescription: string;
  isPrivate: boolean;
  canEdit: boolean;
  /** The cover picker trigger, when the page has no cover yet. */
  addCover?: React.ReactNode;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon ?? "");
  const [description, setDescription] = useState(initialDescription);
  const [showDescription, setShowDescription] = useState(
    initialDescription.length > 0,
  );
  const { report } = useSaveStatus();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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

  function schedule(key: string, action: () => Promise<unknown>) {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(
      () => persist(key, action),
      SAVE_DEBOUNCE_MS,
    );
  }

  function flush(key: string, action: () => Promise<unknown>) {
    clearTimeout(timers.current[key]);
    persist(key, action);
  }

  const affordances = canEdit && (addCover || !showDescription);

  return (
    <header className="group/header space-y-2">
      {affordances && (
        <div className="-ml-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within/header:opacity-100 group-hover/header:opacity-100 [@media(hover:none)]:opacity-100">
          {addCover}
          {!showDescription && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                setShowDescription(true);
                requestAnimationFrame(() => descriptionRef.current?.focus());
              }}
            >
              <AlignLeft /> Add description
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={icon}
          readOnly={!canEdit}
          onChange={(e) => {
            const next = e.target.value.slice(-2);
            setIcon(next);
            schedule("icon", () => setPageIcon(pageId, next || null));
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
          schedule("title", () => renamePage(pageId, e.target.value));
        }}
        onBlur={() => {
          if (!canEdit || title === initialTitle) return;
          flush("title", () => renamePage(pageId, title));
        }}
        placeholder="Untitled"
        aria-label="Page title"
        className={`${fieldClass} w-full text-4xl font-bold tracking-tight`}
      />
      {(showDescription || (!canEdit && description)) && (
        <textarea
          ref={descriptionRef}
          value={description}
          readOnly={!canEdit}
          rows={1}
          maxLength={500}
          onChange={(e) => {
            setDescription(e.target.value);
            schedule("description", () =>
              setPageDescription(pageId, e.target.value),
            );
          }}
          onBlur={() => {
            if (!canEdit) return;
            if (description.trim() === "") setShowDescription(false);
            if (description !== initialDescription)
              flush("description", () =>
                setPageDescription(pageId, description),
              );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Add a description"
          aria-label="Page description"
          className={cn(
            fieldClass,
            "w-full resize-none text-base leading-relaxed text-muted-foreground field-sizing-content",
          )}
        />
      )}
    </header>
  );
}
