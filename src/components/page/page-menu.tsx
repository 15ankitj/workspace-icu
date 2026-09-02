"use client";

import { useState, useTransition } from "react";
import { Check, Flag, MoreHorizontal } from "lucide-react";
import { setPageLayout } from "@/app/actions/pages";
import { reportPage } from "@/app/actions/reports";
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
import { cn } from "@/lib/utils";

function Tick({ on }: { on: boolean }) {
  return <Check className={cn("size-4", !on && "invisible")} />;
}

/** Page ⋯ menu: layout toggles (editors) and report content (everyone). */
export function PageMenu({
  pageId,
  fullWidth,
  smallText,
  canEdit,
}: {
  pageId: string;
  fullWidth: boolean;
  smallText: boolean;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Page options">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <>
              <DropdownMenuLabel>Layout</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(() =>
                    setPageLayout(pageId, { fullWidth: !fullWidth }),
                  )
                }
              >
                <Tick on={fullWidth} /> Full width
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(() =>
                    setPageLayout(pageId, { smallText: !smallText }),
                  )
                }
              >
                <Tick on={smallText} /> Small text
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setReported(false);
              setReason("");
              setReporting(true);
            }}
          >
            <Flag /> Report content
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent>
          <DialogTitle>Report this page</DialogTitle>
          <DialogDescription>
            Reports go to the platform owner — for example if this page contains
            patient-identifiable information or other content that
            shouldn&apos;t be here.
          </DialogDescription>
          {reported ? (
            <p className="text-sm">
              Thank you — the report has been sent for review.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  await reportPage(pageId, reason);
                  setReported(true);
                });
              }}
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="What's the problem?"
                className="w-full rounded-md border border-input bg-transparent p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex justify-end">
                <Button type="submit">Send report</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
