"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickablePage {
  id: string;
  title: string;
  icon: string | null;
}

/**
 * The workspace page search shared by the page-link block, the `@` menu's
 * page half and relation properties: a title filter over the pages the
 * viewer can see (loaded once per page view, trashed pages excluded).
 * Pages in `selectedIds` show a tick and picking one again means "remove";
 * the caller decides what a pick does.
 */
export function PagePicker({
  pages,
  onPick,
  selectedIds,
  excludeIds,
  placeholder = "Link to page…",
  limit = 8,
  autoFocus = true,
  className,
}: {
  pages: PickablePage[];
  onPick: (page: PickablePage) => void;
  selectedIds?: ReadonlySet<string>;
  excludeIds?: ReadonlySet<string>;
  placeholder?: string;
  limit?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = pages
    .filter((p) => !excludeIds?.has(p.id))
    .filter((p) => !q || (p.title || "Untitled").toLowerCase().includes(q))
    .slice(0, limit);

  return (
    <div className={className}>
      <Input
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <ul className="mt-1 max-h-56 overflow-y-auto" role="listbox">
        {matches.map((page) => {
          const selected = selectedIds?.has(page.id) ?? false;
          return (
            <li key={page.id} role="option" aria-selected={selected}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent",
                  selected && "font-medium",
                )}
                onClick={() => onPick(page)}
              >
                <span className="w-4 shrink-0 text-center" aria-hidden>
                  {page.icon ?? "📄"}
                </span>
                <span className="truncate">{page.title || "Untitled"}</span>
                {selected && (
                  <Check className="ml-auto size-4 shrink-0" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
        {matches.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            No matching pages.
          </li>
        )}
      </ul>
    </div>
  );
}
