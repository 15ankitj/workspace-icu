"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/app/actions/suggestions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeNotification, type NotificationKind } from "@/lib/digest";
import { formatRelativeShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface UpdateItem {
  id: string;
  kind: NotificationKind;
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  actorName: string | null;
  createdAt: string;
  read: boolean;
}

/**
 * Suggestion activity for this user in this workspace (Appendix A §2.5):
 * a count in the sidebar, a list behind it. Opening the list marks
 * everything read; the daily email digest covers what was not opened.
 */
export function UpdatesDialog({
  workspaceId,
  updates,
}: {
  workspaceId: string;
  updates: UpdateItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const unread = updates.filter((u) => !u.read).length;

  return (
    <>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => {
          setOpen(true);
          if (unread > 0) {
            startTransition(async () => {
              try {
                await markNotificationsRead(workspaceId);
                router.refresh();
              } catch {
                // The list still shows; the badge clears next time.
              }
            });
          }
        }}
      >
        <Bell /> Updates
        {unread > 0 && (
          <span className="ml-auto rounded-full bg-amber-600/15 px-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            {unread}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Updates</DialogTitle>
          <DialogDescription>
            Suggestion activity on pages you author or suggested on.
          </DialogDescription>
          {updates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto text-sm">
              {updates.map((u) => (
                <li key={u.id} className="py-2">
                  <Link
                    href={`/w/${workspaceId}/p/${u.pageId}`}
                    className={cn(
                      "block rounded-md hover:bg-accent",
                      !u.read && "font-medium",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <span className="block">
                      {describeNotification(u.kind, u.actorName)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {u.pageIcon ? `${u.pageIcon} ` : ""}
                      {u.pageTitle || "Untitled"} ·{" "}
                      {formatRelativeShort(u.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
