"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDownUp, Plus } from "lucide-react";
import { createPage } from "@/app/actions/pages";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/page-shell";
import { SegmentedControl } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { formatDate, formatPropertyDate, formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface SubPage {
  id: string;
  title: string;
  icon: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** From the page's own properties, when it has them. */
  type: string | null;
  date: string | null;
  people: { id: string; name: string }[];
}

type Filter = "all" | "mine" | "recent";
type Sort = "order" | "updated" | "title";

/**
 * The child pages of a page as a list, with the two questions people
 * actually ask of it: which are mine, and what changed lately. Both come
 * from data every page already carries; this is not a database view.
 */
export function SubPages({
  workspaceId,
  pageId,
  pages,
  currentUserId,
  canEdit,
}: {
  workspaceId: string;
  pageId: string;
  pages: SubPage[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("order");
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    let list = pages;
    if (filter === "mine")
      list = list.filter((p) => p.createdBy === currentUserId);
    if (filter === "recent" || sort === "updated")
      list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (sort === "title")
      list = [...list].sort((a, b) =>
        (a.title || "Untitled").localeCompare(b.title || "Untitled"),
      );
    return list;
  }, [pages, filter, sort, currentUserId]);

  const newSubPage = () =>
    startTransition(async () => {
      try {
        await createPage(workspaceId, pageId);
      } catch (error) {
        // createPage redirects on success; a redirect throws internally and
        // must not be reported as a failure.
        if (error instanceof Error && /NEXT_REDIRECT/.test(error.message))
          throw error;
        toast({
          variant: "destructive",
          title: "Couldn't create the page",
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    });

  const showMeta = pages.some((p) => p.type || p.people.length || p.date);

  return (
    <section className="space-y-3" aria-label="Sub-pages">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading>
          Sub-pages
          <span className="font-normal text-muted-foreground">
            {pages.length}
          </span>
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-2">
          {pages.length > 1 && (
            <>
              <SegmentedControl
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "mine", label: "Mine" },
                  { value: "recent", label: "Recently edited" },
                ]}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label={`Sort: ${sort === "order" ? "sidebar order" : sort === "updated" ? "last edited" : "title"}. Change sort`}
                title="Change sort"
                onClick={() =>
                  setSort((s) =>
                    s === "order"
                      ? "updated"
                      : s === "updated"
                        ? "title"
                        : "order",
                  )
                }
              >
                <ArrowDownUp />
              </Button>
            </>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant={pages.length === 0 ? "secondary" : "default"}
              disabled={isPending}
              onClick={newSubPage}
            >
              <Plus /> {isPending ? "Creating…" : "New sub-page"}
            </Button>
          )}
        </div>
      </div>

      {pages.length === 0 ? (
        <EmptyState title="No sub-pages yet">
          Pages you create here are listed with who wrote them and when they
          last changed.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState compact>
          None of these pages were created by you.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-md border">
          {visible.map((page) => (
            <li key={page.id}>
              <Link
                href={`/w/${workspaceId}/p/${page.id}`}
                className="flex min-h-11 items-center gap-3 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <span className="w-5 shrink-0 text-center" aria-hidden>
                  {page.icon ?? "📄"}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {page.title || "Untitled"}
                </span>
                {showMeta && (
                  <span className="hidden items-center gap-3 sm:flex">
                    {page.type && <Badge variant="muted">{page.type}</Badge>}
                    {page.people.length > 0 && (
                      <span className="flex items-center">
                        {page.people.slice(0, 3).map((p, i) => (
                          <Avatar
                            key={p.id}
                            id={p.id}
                            name={p.name}
                            size="sm"
                            className={cn(
                              "ring-2 ring-background",
                              i > 0 && "-ml-1.5",
                            )}
                          />
                        ))}
                      </span>
                    )}
                    <span className="w-28 text-right text-xs text-muted-foreground">
                      {page.date
                        ? formatPropertyDate(page.date)
                        : formatDate(page.createdAt)}
                    </span>
                  </span>
                )}
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                  {formatRelative(page.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
