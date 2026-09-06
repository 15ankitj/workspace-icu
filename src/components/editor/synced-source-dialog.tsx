"use client";

import { useEffect, useState } from "react";
import {
  deleteSyncedBlockEverywhere,
  listSyncedHosts,
  reassignSyncedSource,
  type SyncedHostPage,
} from "@/app/actions/synced";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

export interface SourceRemovalTarget {
  id: string;
  title: string;
  /** Pages other than this one that host a placement. */
  otherPages: number;
}

/**
 * The prompt when a synced block's *source* placement leaves its page
 * (Appendix A §1.3 rule 6): "This block appears in N other pages. Delete
 * everywhere, or choose a new source?" — plus "Put it back", because the
 * removal may have been a slip. Closing the dialog decides nothing; the
 * page then shows the block among its detached sources until it is
 * resolved, so nothing is orphaned silently.
 */
export function SourceRemovalDialog({
  target,
  ...props
}: {
  target: SourceRemovalTarget | null;
  onPutBack: (() => void) | null;
  onResolved: (id: string, outcome: "deleted" | "reassigned") => void;
  onClose: () => void;
}) {
  if (!target) return null;
  // Keyed on the block, so a new target starts from a clean dialog.
  return <RemovalDialog key={target.id} target={target} {...props} />;
}

function RemovalDialog({
  target,
  onPutBack,
  onResolved,
  onClose,
}: {
  target: SourceRemovalTarget;
  onPutBack: (() => void) | null;
  onResolved: (id: string, outcome: "deleted" | "reassigned") => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [hosts, setHosts] = useState<SyncedHostPage[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!picking || hosts !== null) return;
    let cancelled = false;
    listSyncedHosts(target.id)
      .then((list) => {
        if (!cancelled) setHosts(list);
      })
      .catch(() => {
        if (!cancelled) setHosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [picking, target, hosts]);

  const label = target.title ? `“${target.title}”` : "This synced block";
  const pages = `${target.otherPages} other page${target.otherPages === 1 ? "" : "s"}`;

  const run = async (
    action: () => Promise<void>,
    outcome: "deleted" | "reassigned",
    done: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast({ title: done });
      onResolved(target.id, outcome);
    } catch (error) {
      toast({
        title: "That didn't work",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  const hidden = hosts ? Math.max(0, target.otherPages - hosts.length) : 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>
          {picking ? "Choose a new source" : "Delete this synced block?"}
        </DialogTitle>
        <DialogDescription>
          {picking
            ? `The page you choose becomes where ${label} lives: editing it anywhere then follows that page's permissions.`
            : target.otherPages > 0
              ? `${label} appears in ${pages}. Delete it everywhere, or choose one of those pages as its new source?`
              : `${label} appears on no other page. Delete it, or put it back?`}
        </DialogDescription>

        {picking && (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {hosts === null && (
              <li className="text-sm text-muted-foreground">Loading…</li>
            )}
            {hosts?.map((host) => (
              <li key={host.pageId}>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
                  onClick={() =>
                    run(
                      () => reassignSyncedSource(target.id, host.pageId),
                      "reassigned",
                      `Source is now “${host.title || "Untitled"}”`,
                    )
                  }
                >
                  <span className="truncate">
                    {host.icon ? `${host.icon} ` : ""}
                    {host.title || "Untitled"}
                  </span>
                  {host.isPrivate && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      private · only you would see it
                    </span>
                  )}
                </button>
              </li>
            ))}
            {hosts !== null && hosts.length === 0 && (
              <li className="text-sm text-muted-foreground">
                None of the pages hosting this block are ones you can edit.
              </li>
            )}
            {hidden > 0 && (
              <li className="text-xs text-muted-foreground">
                {hidden} more page{hidden === 1 ? "" : "s"} you can&apos;t see.
              </li>
            )}
          </ul>
        )}

        <DialogFooter>
          {picking ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPicking(false)}
            >
              Back
            </Button>
          ) : (
            <>
              {onPutBack && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    onPutBack();
                    onClose();
                  }}
                >
                  Put it back
                </Button>
              )}
              {target.otherPages > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setPicking(true)}
                >
                  Choose a new source
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  run(
                    () => deleteSyncedBlockEverywhere(target.id),
                    "deleted",
                    target.otherPages > 0
                      ? "Deleted everywhere"
                      : "Synced block deleted",
                  )
                }
              >
                {busy
                  ? "Working…"
                  : target.otherPages > 0
                    ? "Delete everywhere"
                    : "Delete"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
