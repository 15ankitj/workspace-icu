"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Download,
  Flag,
  LayoutTemplate,
  Link2,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import { setPageLayout } from "@/app/actions/pages";
import { reportPage } from "@/app/actions/reports";
import { setPublicLink } from "@/app/actions/shares";
import { SaveTemplateDialog } from "@/components/page/save-template-dialog";
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
import { cn } from "@/lib/utils";

function Tick({ on }: { on: boolean }) {
  return <Check className={cn("size-4", !on && "invisible")} />;
}

export interface ShareState {
  enabled: boolean;
  token: string | null;
}

/** Page ⋯ menu: sharing, templates and layout (editors), report (everyone). */
export function PageMenu({
  pageId,
  workspaceId,
  fullWidth,
  smallText,
  canEdit,
  share,
  isPlatformOwner,
}: {
  pageId: string;
  workspaceId: string;
  fullWidth: boolean;
  smallText: boolean;
  canEdit: boolean;
  share: ShareState | null;
  isPlatformOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareState, setShareState] = useState<ShareState>(
    share ?? { enabled: false, token: null },
  );
  const [copied, setCopied] = useState(false);

  const shareUrl =
    shareState.enabled && shareState.token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareState.token}`
      : null;

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
              <DropdownMenuItem onSelect={() => setSharing(true)}>
                <Link2 /> Share…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSavingTemplate(true)}>
                <LayoutTemplate /> Save as template…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={`/api/export/${pageId}`}>
              <Download /> Markdown (this page)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/export/${pageId}?tree=1`}>
              <Download /> Markdown (with sub-pages)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/print/${pageId}`} target="_blank" rel="noreferrer">
              <Printer /> Print / PDF (this page)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/print/${pageId}?tree=1`}
              target="_blank"
              rel="noreferrer"
            >
              <Printer /> Print / PDF (with sub-pages)
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      <SaveTemplateDialog
        open={savingTemplate}
        onOpenChange={setSavingTemplate}
        workspaceId={workspaceId}
        pageId={pageId}
        isPlatformOwner={isPlatformOwner}
      />

      <Dialog open={sharing} onOpenChange={setSharing}>
        <DialogContent>
          <DialogTitle>Share this page</DialogTitle>
          <DialogDescription>
            A public link lets anyone with it read this page — no sign-in
            needed. Attachments still require sign-in. You can revoke the link
            at any time; the old link stops working immediately.
          </DialogDescription>
          {shareState.enabled && shareUrl ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-xs" />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setPublicLink(pageId, false);
                    setShareState({ enabled: false, token: null });
                  })
                }
              >
                Revoke public link
              </Button>
            </div>
          ) : (
            <Button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const { token } = await setPublicLink(pageId, true);
                  setShareState({ enabled: true, token });
                })
              }
            >
              Create public read-only link
            </Button>
          )}
        </DialogContent>
      </Dialog>

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
