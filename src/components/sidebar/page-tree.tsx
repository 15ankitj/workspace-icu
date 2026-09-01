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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DropMode = "before" | "after" | "child";

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
  const [, startTransition] = useTransition();

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
      <p className="px-2 py-1 text-xs text-muted-foreground">No pages yet.</p>
    );
  }

  return (
    <ul role="tree">
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
  const [dropMode, setDropMode] = useState<DropMode | null>(null);
  const [, startTransition] = useTransition();

  function modeFromEvent(event: React.DragEvent<HTMLElement>): DropMode {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < rect.height / 4) return "before";
    if (y > (rect.height * 3) / 4) return "after";
    return "child";
  }

  return (
    <li
      role="treeitem"
      aria-selected={page.id === activePageId}
      aria-expanded={children.length > 0 ? isExpanded : undefined}
    >
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-accent hover:text-accent-foreground",
          page.id === activePageId && "bg-accent font-medium",
          dropMode === "child" && "ring-1 ring-ring",
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
          className={cn(
            "rounded p-0.5 text-muted-foreground hover:bg-background",
            children.length === 0 && "invisible",
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
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
          className="flex min-w-0 flex-1 items-center gap-1.5"
        >
          <span className="w-4 shrink-0 text-center">{page.icon ?? "📄"}</span>
          <span className="truncate">{page.title || "Untitled"}</span>
          {page.is_private && (
            <Lock className="size-3 shrink-0 text-muted-foreground" />
          )}
        </Link>

        {canEdit && (
          <span className="hidden items-center group-hover:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-background"
                  aria-label="Page actions"
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
                  onSelect={() =>
                    startTransition(() => deletePage(workspaceId, page.id))
                  }
                >
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-background"
              aria-label="Add sub-page"
              onClick={() =>
                startTransition(() => createPage(workspaceId, page.id))
              }
            >
              <Plus className="size-3.5" />
            </button>
          </span>
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <ul role="group">
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
