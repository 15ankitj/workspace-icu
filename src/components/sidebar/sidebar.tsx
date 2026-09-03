"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Clock,
  LayoutTemplate,
  LogOut,
  Plus,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import type { WorkspaceRole } from "@/lib/database.types";
import type { TreePage } from "@/lib/tree";
import { createPage } from "@/app/actions/pages";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageTree } from "@/components/sidebar/page-tree";
import { SearchDialog } from "@/components/sidebar/search-dialog";
import { ImportDialog } from "@/components/sidebar/import-dialog";
import { WorkspaceSwitcher } from "@/components/sidebar/workspace-switcher";
import { cn } from "@/lib/utils";

export interface SidebarWorkspace {
  id: string;
  name: string;
  icon: string | null;
  is_personal: boolean;
}

/** Group label style, shared with the page tree. */
export const sidebarGroupLabel =
  "flex items-center gap-1.5 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function Sidebar({
  userId,
  workspaces,
  currentWorkspace,
  role,
  pages,
  favourites,
  recents,
}: {
  userId: string;
  workspaces: SidebarWorkspace[];
  currentWorkspace: SidebarWorkspace;
  role: WorkspaceRole;
  pages: TreePage[];
  favourites: TreePage[];
  recents: TreePage[];
}) {
  const params = useParams<{ pageId?: string }>();
  const activePageId = params.pageId ?? null;
  const canEdit = role === "owner" || role === "editor";

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1 p-2">
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
        />
        <Button variant="ghost" size="icon-sm" asChild>
          <Link
            href={`/w/${currentWorkspace.id}/gallery`}
            aria-label="Template gallery"
            title="Template gallery"
          >
            <LayoutTemplate />
          </Link>
        </Button>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link
            href={`/w/${currentWorkspace.id}/trash`}
            aria-label="Trash"
            title="Trash"
          >
            <Trash2 />
          </Link>
        </Button>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link
            href={`/w/${currentWorkspace.id}/settings`}
            aria-label="Workspace settings"
            title="Workspace settings"
          >
            <Settings />
          </Link>
        </Button>
      </div>
      <Separator />
      <div className="p-2">
        <SearchDialog />
        {canEdit && <ImportDialog workspaceId={currentWorkspace.id} />}
      </div>
      <Separator />

      <nav
        aria-label="Workspace pages"
        className="flex-1 space-y-4 overflow-y-auto p-2"
      >
        {favourites.length > 0 && (
          <section>
            <h2 className={sidebarGroupLabel}>
              <Star className="size-3" aria-hidden /> Favourites
            </h2>
            <ul>
              {favourites.map((page) => (
                <SidebarLink
                  key={page.id}
                  workspaceId={currentWorkspace.id}
                  page={page}
                  active={page.id === activePageId}
                />
              ))}
            </ul>
          </section>
        )}

        {recents.length > 0 && (
          <section>
            <h2 className={sidebarGroupLabel}>
              <Clock className="size-3" aria-hidden /> Recent
            </h2>
            <ul>
              {recents.map((page) => (
                <SidebarLink
                  key={page.id}
                  workspaceId={currentWorkspace.id}
                  page={page}
                  active={page.id === activePageId}
                />
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between pb-1">
            <h2 className={cn(sidebarGroupLabel, "pb-0")}>Pages</h2>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="New page"
                title="New page"
                onClick={() => createPage(currentWorkspace.id, null)}
              >
                <Plus />
              </Button>
            )}
          </div>
          <PageTree
            userId={userId}
            workspaceId={currentWorkspace.id}
            pages={pages}
            activePageId={activePageId}
            canEdit={canEdit}
          />
        </section>
      </nav>

      <Separator />
      <form action="/auth/sign-out" method="post" className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
        >
          <LogOut /> Sign out
        </Button>
      </form>
    </aside>
  );
}

function SidebarLink({
  workspaceId,
  page,
  active,
}: {
  workspaceId: string;
  page: TreePage;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={`/w/${workspaceId}/p/${page.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground",
          active && "bg-selected font-medium",
        )}
      >
        <span className="w-4 shrink-0 text-center" aria-hidden>
          {page.icon ?? "📄"}
        </span>
        <span className="truncate">{page.title || "Untitled"}</span>
      </Link>
    </li>
  );
}
