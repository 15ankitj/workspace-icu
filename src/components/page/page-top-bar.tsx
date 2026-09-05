"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, Home, Lock, MessageSquare, Star } from "lucide-react";
import { toggleFavourite } from "@/app/actions/pages";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useSaveStatus } from "@/components/page/save-status";
import { PresenceAvatars } from "@/components/page/presence";
import { formatDateTime, formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface Crumb {
  id: string;
  title: string;
  icon: string | null;
}

export interface EditedBy {
  at: string;
  name: string;
  isYou: boolean;
}

/** The slot in the workspace shell's phone header that page bars fill. */
export const MOBILE_BAR_SLOT_ID = "mobile-page-bar";

function subscribeNever() {
  return () => {};
}

/**
 * The page's control strip: breadcrumb from the workspace, who edited it
 * last, who is here, comments, Share, favourite and the page menu. On a
 * phone the essentials (parent crumb, favourite, menu) move into the
 * workspace shell's header so there is one bar, not two.
 */
export function PageTopBar({
  workspaceId,
  workspaceName,
  pageId,
  title,
  icon,
  crumbs,
  edited,
  created,
  commentCount,
  isFavourite,
  canEdit,
  collab,
  actions,
}: {
  workspaceId: string;
  workspaceName: string;
  pageId: string;
  title: string;
  icon: string | null;
  crumbs: Crumb[];
  edited: EditedBy;
  created: { at: string; name: string };
  commentCount: number;
  isFavourite: boolean;
  canEdit: boolean;
  collab: { storedStateBase64: string | null; userName: string } | null;
  /** Share button and page menu, rendered by the server page. */
  actions: React.ReactNode;
}) {
  const { state } = useSaveStatus();
  const [ownEditAt, setOwnEditAt] = useState<string | null>(null);
  const [favourite, setFavourite] = useState(isFavourite);
  const [, startTransition] = useTransition();
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  // Once this viewer's own save lands, the bar says so without a reload.
  // Adjusted during render on the transition into "saved" (React's
  // recommended shape for state derived from a prop change).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state === "saved") setOwnEditAt(new Date().toISOString());
  }

  const shownEdit: EditedBy = ownEditAt
    ? { at: ownEditAt, name: "You", isYou: true }
    : edited;
  const parent = crumbs.at(-1);

  function onToggleFavourite() {
    const next = !favourite;
    setFavourite(next);
    startTransition(async () => {
      try {
        await toggleFavourite(workspaceId, pageId);
      } catch (error) {
        setFavourite(!next);
        toast({
          variant: "destructive",
          title: "Couldn't update favourites",
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    });
  }

  const favouriteButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={favourite}
      aria-label={favourite ? "Remove from favourites" : "Add to favourites"}
      title={favourite ? "Remove from favourites" : "Add to favourites"}
      className={cn(favourite ? "text-amber-600" : "text-muted-foreground")}
      onClick={onToggleFavourite}
    >
      <Star className={cn(favourite && "fill-current")} />
    </Button>
  );

  const mobileSlot = mounted
    ? document.getElementById(MOBILE_BAR_SLOT_ID)
    : null;

  return (
    <>
      {mobileSlot &&
        createPortal(
          <div data-page-bar className="flex min-w-0 flex-1 items-center gap-1">
            <Link
              href={
                parent
                  ? `/w/${workspaceId}/p/${parent.id}`
                  : `/w/${workspaceId}`
              }
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-2 text-sm text-muted-foreground"
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              <span aria-hidden>{parent ? (parent.icon ?? "📄") : "🏠"}</span>
              <span className="truncate">
                {parent ? parent.title || "Untitled" : workspaceName}
              </span>
            </Link>
            {favouriteButton}
            {actions}
          </div>,
          mobileSlot,
        )}

      <header className="sticky top-0 z-30 -mx-6 hidden items-center justify-between gap-4 border-b bg-background/95 px-6 py-1.5 backdrop-blur md:-mx-12 md:flex md:px-12">
        <nav
          aria-label="Breadcrumb"
          className="min-w-0 text-sm text-muted-foreground"
        >
          <ol className="flex min-w-0 items-center gap-1">
            <li className="flex items-center gap-1">
              <Link
                href={`/w/${workspaceId}`}
                className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 hover:bg-accent hover:text-foreground"
              >
                <Home className="size-4" aria-hidden />
                <span className="max-w-40 truncate">{workspaceName}</span>
              </Link>
              <span aria-hidden className="text-border">
                /
              </span>
            </li>
            {crumbs.map((crumb, index) => {
              // Deep trails keep the first and last two crumbs.
              const collapsed =
                crumbs.length > 3 && index > 0 && index < crumbs.length - 2;
              if (collapsed && index === 1) {
                return (
                  <li key="ellipsis" className="flex items-center gap-1">
                    <span className="px-1" aria-label="Hidden pages">
                      …
                    </span>
                    <span aria-hidden className="text-border">
                      /
                    </span>
                  </li>
                );
              }
              if (collapsed) return null;
              return (
                <li key={crumb.id} className="flex min-w-0 items-center gap-1">
                  <Link
                    href={`/w/${workspaceId}/p/${crumb.id}`}
                    className="flex h-7 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <span aria-hidden>{crumb.icon ?? "📄"}</span>
                    <span className="max-w-40 truncate">
                      {crumb.title || "Untitled"}
                    </span>
                  </Link>
                  <span aria-hidden className="text-border">
                    /
                  </span>
                </li>
              );
            })}
            <li
              className="flex h-7 min-w-0 items-center gap-1.5 px-1.5 text-foreground"
              aria-current="page"
            >
              <span aria-hidden>{icon ?? "📄"}</span>
              <span className="max-w-64 truncate">{title || "Untitled"}</span>
            </li>
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {!canEdit && (
            <span className="mr-1 inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden /> Read only
            </span>
          )}
          <span
            className="px-2 text-xs text-muted-foreground"
            title={`${shownEdit.isYou ? "You" : shownEdit.name} · ${formatDateTime(shownEdit.at)}\nCreated by ${created.name} · ${formatDateTime(created.at)}`}
          >
            Edited {formatRelative(shownEdit.at)} · {shownEdit.name}
          </span>
          {collab && (
            <PresenceAvatars
              pageId={pageId}
              storedStateBase64={collab.storedStateBase64}
              selfName={collab.userName}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            asChild
          >
            <a href="#comments" aria-label={`${commentCount} comments`}>
              <MessageSquare /> {commentCount}
            </a>
          </Button>
          {actions}
          {favouriteButton}
        </div>
      </header>
    </>
  );
}
