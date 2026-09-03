"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { createWorkspace } from "@/app/actions/workspaces";
import type { SidebarWorkspace } from "@/components/sidebar/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspace,
}: {
  workspaces: SidebarWorkspace[];
  currentWorkspace: SidebarWorkspace;
}) {
  const [creating, setCreating] = useState(false);
  const nameId = useId();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-start px-2"
            aria-label={`Workspace: ${currentWorkspace.name}. Switch workspace`}
          >
            <span aria-hidden>{currentWorkspace.icon ?? "🗂️"}</span>
            <span className="truncate">{currentWorkspace.name}</span>
            <ChevronsUpDown className="ml-auto text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => {
            const current = workspace.id === currentWorkspace.id;
            return (
              <DropdownMenuItem key={workspace.id} asChild>
                <Link
                  href={`/w/${workspace.id}`}
                  aria-current={current ? "true" : undefined}
                >
                  <span aria-hidden>{workspace.icon ?? "🗂️"}</span>
                  <span className="truncate">{workspace.name}</span>
                  {current && (
                    <Check className="ml-auto text-muted-foreground" />
                  )}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus /> New workspace…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            A shared space with its own pages and members.
          </DialogDescription>
          <form action={createWorkspace} className="space-y-4">
            <Field label="Workspace name" htmlFor={nameId}>
              <Input
                id={nameId}
                name="name"
                placeholder="e.g. ICU teaching"
                required
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <SubmitButton pendingLabel="Creating…">
                Create workspace
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
