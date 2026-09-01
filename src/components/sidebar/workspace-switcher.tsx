"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import { createWorkspace } from "@/app/actions/workspaces";
import type { SidebarWorkspace } from "@/components/sidebar/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspace,
}: {
  workspaces: SidebarWorkspace[];
  currentWorkspace: SidebarWorkspace;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <span>{currentWorkspace.icon ?? "🗂️"}</span>
            <span className="truncate">{currentWorkspace.name}</span>
            <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} asChild>
              <Link href={`/w/${workspace.id}`}>
                <span>{workspace.icon ?? "🗂️"}</span>
                <span className="truncate">{workspace.name}</span>
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            A shared space with its own pages and members.
          </DialogDescription>
          <form action={createWorkspace} className="space-y-3">
            <Input
              name="name"
              placeholder="Workspace name"
              required
              autoFocus
            />
            <Button type="submit" className="w-full">
              Create workspace
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
