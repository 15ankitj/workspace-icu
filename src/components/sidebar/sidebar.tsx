"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Clock,
  Home,
  LayoutTemplate,
  LogOut,
  PanelLeft,
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
import { useSidebarCollapse } from "@/components/sidebar/app-shell";
import { formatRelativeShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface SidebarWorkspace {
  id: string;
  name: string;
  icon: string | null;
  is_personal: boolean;
}

export interface RecentPage extends TreePage {
  viewedAt: string;
}

/** Group label style, shared with the page tree. */
export const sidebarGroupLabel =
  "flex items-center gap-1.5 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground";

const navRow =
  "flex h-8 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground";

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
  recents: RecentPage[];
}) {
  const params = useParams<{ pageId?: string }>();
  const pathname = usePathname();
  const activePageId = params.pageId ?? null;
  const canEdit = role === "owner" || role === "editor";
  const { toggle } = useSidebarCollapse();
  const base = `/w/${currentWorkspace.id}`;

  const navLink = (href: string, exact = false) =>
    cn(
      navRow,
      (exact ? pathname === href : pathname.startsWith(href)) &&
        "bg-selected text-foreground",
    );

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1 p-2">
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden text-muted-foreground md:inline-flex"
          aria-label="Collapse sidebar"
          title="Collapse sidebar (⌘\)"
          onClick={toggle}
        >
          <PanelLeft />
        </Button>
      </div>
      <Separator />
      <div className="flex flex-col gap-0.5 p-2">
        <SearchDialog />
        <Link href={base} className={navLink(base, true)}>
          <Home /> Home
        </Link>
        <Link href={`${base}/gallery`} className={navLink(`${base}/gallery`)}>
          <LayoutTemplate /> Templates
        </Link>
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
                  trailing={
                    <span
                      className="text-xs text-muted-foreground"
                      title={`Opened ${new Date(page.viewedAt).toLocaleString("en-GB")}`}
                    >
                      {formatRelativeShort(page.viewedAt)}
                    </span>
                  }
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
      <div className="flex flex-col gap-0.5 p-2">
        <Link href={`${base}/trash`} className={navLink(`${base}/trash`)}>
          <Trash2 /> Trash
        </Link>
        <Link href={`${base}/settings`} className={navLink(`${base}/settings`)}>
          <Settings /> Settings
        </Link>
        <form action="/auth/sign-out" method="post">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({
  workspaceId,
  page,
  active,
  trailing,
}: {
  workspaceId: string;
  page: TreePage;
  active: boolean;
  trailing?: React.ReactNode;
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
        <span className="min-w-0 flex-1 truncate">
          {page.title || "Untitled"}
        </span>
        {trailing}
      </Link>
    </li>
  );
}
