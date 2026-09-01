"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, Plus, Settings, Star } from "lucide-react";
import type { WorkspaceRole } from "@/lib/database.types";
import type { TreePage } from "@/lib/tree";
import { createPage } from "@/app/actions/pages";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageTree } from "@/components/sidebar/page-tree";
import { WorkspaceSwitcher } from "@/components/sidebar/workspace-switcher";

export interface SidebarWorkspace {
  id: string;
  name: string;
  icon: string | null;
  is_personal: boolean;
}

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
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1 p-2">
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
        />
        <Button variant="ghost" size="icon-sm" asChild>
          <Link
            href={`/w/${currentWorkspace.id}/settings`}
            aria-label="Workspace settings"
          >
            <Settings />
          </Link>
        </Button>
      </div>
      <Separator />

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {favourites.length > 0 && (
          <section>
            <h2 className="flex items-center gap-1 px-2 pb-1 text-xs font-medium text-muted-foreground">
              <Star className="size-3" /> Favourites
            </h2>
            {favourites.map((page) => (
              <SidebarLink
                key={page.id}
                workspaceId={currentWorkspace.id}
                page={page}
                active={page.id === activePageId}
              />
            ))}
          </section>
        )}

        {recents.length > 0 && (
          <section>
            <h2 className="flex items-center gap-1 px-2 pb-1 text-xs font-medium text-muted-foreground">
              <Clock className="size-3" /> Recent
            </h2>
            {recents.slice(0, 5).map((page) => (
              <SidebarLink
                key={page.id}
                workspaceId={currentWorkspace.id}
                page={page}
                active={page.id === activePageId}
              />
            ))}
          </section>
        )}

        <section>
          <div className="flex items-center justify-between px-2 pb-1">
            <h2 className="text-xs font-medium text-muted-foreground">Pages</h2>
            {canEdit && (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="New page"
                onClick={() => createPage(currentWorkspace.id, null)}
              >
                <Plus className="size-4" />
              </button>
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
        <Button variant="ghost" size="sm" className="w-full justify-start">
          Sign out
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
    <Link
      href={`/w/${workspaceId}/p/${page.id}`}
      className={`flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground ${
        active ? "bg-accent font-medium" : ""
      }`}
    >
      <span className="w-4 text-center">{page.icon ?? "📄"}</span>
      <span className="truncate">{page.title || "Untitled"}</span>
    </Link>
  );
}
