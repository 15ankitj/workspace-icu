"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import {
  buildTree,
  siblingsOf,
  type PageNode,
  type TreePage,
} from "@/lib/tree";
import {
  createPage,
  deletePage,
  movePage,
  setPagePrivacy,
  toggleFavourite,
} from "@/app/actions/pages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type DropMode = "before" | "after" | "child";

/** Small square icon button used inside tree rows. */
const rowButton =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PageTree({
  userId,
  workspaceId,
  pages,
  activePageId,
  canEdit,
}: {
  userId: string;
  workspaceId: string;
  pages: TreePage[];
  activePageId: string | null;
  canEdit: boolean;
}) {
  const tree = useMemo(() => buildTree(pages), [pages]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDrop(target: TreePage, mode: DropMode) {
    if (!dragId || dragId === target.id) return;
    const moved = dragId;
    setDragId(null);

    let newParentId: string | null;
    let beforeId: string | null = null;
    let afterId: string | null = null;

    if (mode === "child") {
      newParentId = target.id;
      const children = siblingsOf(pages, target.id).filter(
        (p) => p.id !== moved,
      );
      beforeId = children.at(-1)?.id ?? null;
    } else {
      newParentId = target.parent_page_id;
      const siblings = siblingsOf(pages, target.parent_page_id).filter(
        (p) => p.id !== moved,
      );
      const index = siblings.findIndex((p) => p.id === target.id);
      if (mode === "before") {
        beforeId = siblings[index - 1]?.id ?? null;
        afterId = target.id;
      } else {
        beforeId = target.id;
        afterId = siblings[index + 1]?.id ?? null;
      }
    }

    startTransition(() =>
      movePage({ workspaceId, pageId: moved, newParentId, beforeId, afterId }),
    );
  }

  if (tree.length === 0) {
    return (
      <EmptyState
        compact
        className="mx-1"
        action={
          canEdit ? (
            <Button
              variant="secondary"
              size="xs"
              disabled={isPending}
              onClick={() =>
                startTransition(() => createPage(workspaceId, null))
              }
            >
              <Plus /> New page
            </Button>
          ) : undefined
        }
      >
        No pages yet.
      </EmptyState>
    );
  }

  return (
    <ul>
      {tree.map((node) => (
        <TreeRow
          key={node.page.id}
          node={node}
          depth={0}
          userId={userId}
          workspaceId={workspaceId}
          activePageId={activePageId}
          canEdit={canEdit}
          expanded={expanded}
          onToggle={toggle}
          dragId={dragId}
          onDragStart={setDragId}
          onDrop={handleDrop}
        />
      ))}
    </ul>
  );
}

function TreeRow({
  node,
  depth,
  userId,
  workspaceId,
  activePageId,
  canEdit,
  expanded,
  onToggle,
  dragId,
  onDragStart,
  onDrop,
}: {
  node: PageNode;
  depth: number;
  userId: string;
  workspaceId: string;
  activePageId: string | null;
  canEdit: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  dragId: string | null;
  onDragStart: (id: string | null) => void;
  onDrop: (target: TreePage, mode: DropMode) => void;
}) {
  const { page, children } = node;
  const isExpanded = expanded.has(page.id);
  const isActive = page.id === activePageId;
  const [dropMode, setDropMode] = useState<DropMode | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [, startTransition] = useTransition();

  function modeFromEvent(event: React.DragEvent<HTMLElement>): DropMode {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < rect.height / 4) return "before";
    if (y > (rect.height * 3) / 4) return "after";
    return "child";
  }

  return (
    <li>
      <div
        className={cn(
          "group relative flex items-center gap-0.5 rounded-md py-0.5 pr-1 text-sm hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-selected font-medium",
          dropMode === "child" && "ring-2 ring-ring",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        draggable={canEdit}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(page.id);
        }}
        onDragEnd={() => onDragStart(null)}
        onDragOver={(e) => {
          if (!dragId || dragId === page.id) return;
          e.preventDefault();
          setDropMode(modeFromEvent(e));
        }}
        onDragLeave={() => setDropMode(null)}
        onDrop={(e) => {
          e.preventDefault();
          const mode = modeFromEvent(e);
          setDropMode(null);
          onDrop(page, mode);
        }}
      >
        {dropMode === "before" && (
          <span className="absolute inset-x-1 top-0 h-0.5 bg-ring" />
        )}
        {dropMode === "after" && (
          <span className="absolute inset-x-1 bottom-0 h-0.5 bg-ring" />
        )}

        <button
          type="button"
          className={cn(rowButton, children.length === 0 && "invisible")}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          aria-expanded={children.length > 0 ? isExpanded : undefined}
          onClick={() => onToggle(page.id)}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>

        <Link
          href={`/w/${workspaceId}/p/${page.id}`}
          aria-current={isActive ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-0.5"
        >
          <span className="w-4 shrink-0 text-center" aria-hidden>
            {page.icon ?? "📄"}
          </span>
          <span className="truncate">{page.title || "Untitled"}</span>
          {page.is_private && (
            <Lock
              className="size-3 shrink-0 text-muted-foreground"
              aria-label="Private"
            />
          )}
        </Link>

        {canEdit && (
          // Revealed on hover, on keyboard focus, and always on touch
          // screens, where there is no hover.
          <span className="flex items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={rowButton}
                  aria-label={`Actions for ${page.title || "Untitled"}`}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() =>
                    startTransition(() => toggleFavourite(workspaceId, page.id))
                  }
                >
                  <Star /> Favourite
                </DropdownMenuItem>
                {page.created_by === userId && (
                  <DropdownMenuItem
                    onSelect={() =>
                      startTransition(() =>
                        setPagePrivacy(page.id, !page.is_private),
                      )
                    }
                  >
                    <Lock />
                    {page.is_private ? "Make shared" : "Make private"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmingDelete(true)}
                >
                  <Trash2 /> Delete…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className={rowButton}
              aria-label={`Add sub-page under ${page.title || "Untitled"}`}
              onClick={() =>
                startTransition(() => createPage(workspaceId, page.id))
              }
            >
              <Plus className="size-3.5" />
            </button>
          </span>
        )}
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogTitle>
            Move “{page.title || "Untitled"}” to the trash?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {children.length > 0
              ? `Its ${children.length} sub-page${children.length === 1 ? "" : "s"} go with it. `
              : ""}
            You can restore it from the trash for 30 days; after that it is
            removed permanently.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(() => deletePage(workspaceId, page.id))
              }
            >
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isExpanded && children.length > 0 && (
        <ul>
          {children.map((child) => (
            <TreeRow
              key={child.page.id}
              node={child}
              depth={depth + 1}
              userId={userId}
              workspaceId={workspaceId}
              activePageId={activePageId}
              canEdit={canEdit}
              expanded={expanded}
              onToggle={onToggle}
              dragId={dragId}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
