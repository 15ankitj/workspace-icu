"use client";

import { useTransition } from "react";
import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { createPage } from "@/app/actions/pages";
import { Button } from "@/components/ui/button";

/** The two things a new user can do with an empty workspace. */
export function EmptyWorkspaceActions({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {canEdit && (
        <Button
          disabled={isPending}
          onClick={() => startTransition(() => createPage(workspaceId, null))}
        >
          <Plus /> {isPending ? "Creating…" : "Create a page"}
        </Button>
      )}
      <Button variant={canEdit ? "secondary" : "default"} asChild>
        <Link href={`/w/${workspaceId}/gallery`}>
          <LayoutTemplate /> Browse the gallery
        </Link>
      </Button>
    </div>
  );
}
