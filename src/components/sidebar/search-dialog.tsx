"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { searchPages, type SearchHit } from "@/app/actions/search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Status = "idle" | "searching" | "done" | "error";

function subscribeNever() {
  return () => {};
}
function modifierKey() {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

/** Full-text search across all of the user's workspaces (brief §5). */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();
  const modifier = useSyncExternalStore(
    subscribeNever,
    modifierKey,
    () => "Ctrl",
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = query.trim();
    // Debounced: short queries clear results, longer ones search.
    timer.current = setTimeout(async () => {
      if (term.length < 2) {
        setHits([]);
        setStatus("idle");
        return;
      }
      setStatus("searching");
      try {
        setHits(await searchPages(term));
        setStatus("done");
      } catch {
        setHits([]);
        setStatus("error");
      }
      setActive(0);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search /> Search
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-sans text-xs text-muted-foreground">
          {modifier} K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 translate-y-0 gap-3 p-3">
          <DialogTitle className="sr-only">Search pages</DialogTitle>
          <Input
            autoFocus
            value={query}
            placeholder="Search all your workspaces…"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-activedescendant={hits.length ? optionId(active) : undefined}
            aria-autocomplete="list"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, hits.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && hits[active]) {
                event.preventDefault();
                document.getElementById(optionId(active))?.click();
              }
            }}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label="Results"
            className="max-h-80 space-y-0.5 overflow-y-auto"
          >
            {hits.map((hit, index) => (
              <li key={hit.id} role="none">
                <Link
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  href={`/w/${hit.workspaceId}/p/${hit.id}`}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "block rounded-md px-2 py-1.5 hover:bg-accent",
                    index === active && "bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="w-4 text-center" aria-hidden>
                      {hit.icon ?? "📄"}
                    </span>
                    <span className="truncate">{hit.title || "Untitled"}</span>
                  </span>
                  {hit.snippet && (
                    <span
                      className="mt-0.5 line-clamp-2 pl-6 text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
                      // ts_headline output: our own text with <b> markers only.
                      dangerouslySetInnerHTML={{
                        __html: hit.snippet.replace(/<(?!\/?b>)[^>]*>/g, ""),
                      }}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="px-2 text-xs text-muted-foreground" role="status">
            {status === "searching" && (
              <span className="flex items-center gap-1.5">
                <Loader2
                  className="size-3 motion-safe:animate-spin"
                  aria-hidden
                />
                Searching…
              </span>
            )}
            {status === "error" && (
              <span className="text-destructive">
                Search isn&apos;t available right now. Try again in a moment.
              </span>
            )}
            {status === "done" && hits.length === 0 && "No pages match."}
            {status === "done" &&
              hits.length > 0 &&
              `${hits.length} result${hits.length === 1 ? "" : "s"} · ↑↓ to move, Enter to open`}
            {status === "idle" && "Type at least two characters to search."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
