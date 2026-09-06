"use client";

import { useState } from "react";
import { purgePage } from "@/app/actions/trash";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { PURGE_DELETE } from "@/lib/synced";

export interface AtRiskSyncedBlock {
  id: string;
  title: string;
  /** Pages outside the purge that still host a placement. */
  placements: number;
  hosts: {
    id: string;
    title: string;
    icon: string | null;
    isPrivate: boolean;
  }[];
}

/**
 * "Delete permanently" in the Trash. When the page (or a page under it)
 * is the source of synced blocks that still appear elsewhere, the purge
 * prompts first (Appendix A §1.3 rule 7): each block is deleted
 * everywhere, or one of its host pages becomes the new source.
 */
export function PurgeButton({
  workspaceId,
  pageId,
  title,
  atRisk,
}: {
  workspaceId: string;
  pageId: string;
  title: string;
  atRisk: AtRiskSyncedBlock[];
}) {
  const [open, setOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, string>>(() =>
    Object.fromEntries(atRisk.map((block) => [block.id, PURGE_DELETE])),
  );
  const [submitting, setSubmitting] = useState(false);

  const hidden = (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="pageId" value={pageId} />
    </>
  );

  if (atRisk.length === 0) {
    return (
      <form action={purgePage}>
        {hidden}
        <ConfirmButton
          size="sm"
          title={`Delete “${title}” permanently?`}
          description="The page, its sub-pages and their files are removed for good. This cannot be undone."
          confirmLabel="Delete permanently"
        >
          Delete permanently
        </ConfirmButton>
      </form>
    );
  }

  const deleting = atRisk.filter(
    (block) => (decisions[block.id] ?? PURGE_DELETE) === PURGE_DELETE,
  ).length;
  // The dialog renders in a portal, outside the form in the DOM; its
  // submit button is tied back to the form by id.
  const formId = `purge-${pageId}`;

  return (
    <form id={formId} action={purgePage} onSubmit={() => setSubmitting(true)}>
      {hidden}
      <input type="hidden" name="decisions" value={JSON.stringify(decisions)} />
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Delete permanently
      </Button>
      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Delete “{title}” permanently?</DialogTitle>
          <DialogDescription>
            This page is the source of {atRisk.length} synced block
            {atRisk.length === 1 ? "" : "s"} that still appear on other pages.
            Decide what happens to each before the page goes.
          </DialogDescription>
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {atRisk.map((block) => (
              <li key={block.id} className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">
                    {block.title || "Synced block"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · appears in {block.placements} other page
                    {block.placements === 1 ? "" : "s"}
                  </span>
                </p>
                <NativeSelect
                  className="w-full"
                  aria-label={`What happens to ${block.title || "this synced block"}`}
                  value={decisions[block.id] ?? PURGE_DELETE}
                  onChange={(e) =>
                    setDecisions((d) => ({ ...d, [block.id]: e.target.value }))
                  }
                >
                  <option value={PURGE_DELETE}>
                    Delete everywhere (placements show what was lost)
                  </option>
                  {block.hosts.map((host) => (
                    <option key={host.id} value={host.id}>
                      Make “{host.icon ? `${host.icon} ` : ""}
                      {host.title || "Untitled"}” the source
                      {host.isPrivate ? " (private page)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting
                ? "Deleting…"
                : deleting > 0
                  ? `Delete page and ${deleting} synced block${deleting === 1 ? "" : "s"}`
                  : "Delete page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
