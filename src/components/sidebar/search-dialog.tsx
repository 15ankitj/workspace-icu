"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchPages, type SearchHit } from "@/app/actions/search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Full-text search across all of the user's workspaces (brief §5). */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        return;
      }
      setSearching(true);
      try {
        setHits(await searchPages(term));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search /> Search
        <kbd className="ml-auto text-[10px] text-muted-foreground">⌘K</kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 translate-y-0">
          <DialogTitle className="sr-only">Search pages</DialogTitle>
          <Input
            autoFocus
            value={query}
            placeholder="Search all your workspaces…"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {hits.map((hit) => (
              <li key={hit.id}>
                <Link
                  href={`/w/${hit.workspaceId}/p/${hit.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-1.5 hover:bg-accent"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="w-4 text-center">{hit.icon ?? "📄"}</span>
                    <span className="truncate">{hit.title || "Untitled"}</span>
                  </span>
                  {hit.snippet && (
                    <span
                      className="mt-0.5 block truncate pl-6 text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
                      // ts_headline output: our own text with <b> markers only.
                      dangerouslySetInnerHTML={{
                        __html: hit.snippet.replace(/<(?!\/?b>)[^>]*>/g, ""),
                      }}
                    />
                  )}
                </Link>
              </li>
            ))}
            {query.trim().length >= 2 && !searching && hits.length === 0 && (
              <li className="px-2 py-1 text-xs text-muted-foreground">
                No pages match.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
