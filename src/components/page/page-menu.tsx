"use client";

import { useId, useState, useTransition } from "react";
import {
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
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

export interface ShareState {
  enabled: boolean;
  token: string | null;
}

/**
 * Page actions: a visible Share button for editors, and a menu for
 * templates, export, layout and reporting.
 */
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
  const reasonId = useId();

  const shareUrl =
    shareState.enabled && shareState.token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareState.token}`
      : null;

  function updateShare(enabled: boolean) {
    startTransition(async () => {
      try {
        if (enabled) {
          const { token } = await setPublicLink(pageId, true);
          setShareState({ enabled: true, token });
        } else {
          await setPublicLink(pageId, false);
          setShareState({ enabled: false, token: null });
          toast({ title: "Public link revoked" });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: enabled
            ? "Couldn't create the link"
            : "Couldn't revoke the link",
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    });
  }

  return (
    <>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSharing(true)}
          aria-haspopup="dialog"
        >
          <Link2 /> Share
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Page options">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {canEdit && (
            <>
              <DropdownMenuItem onSelect={() => setSavingTemplate(true)}>
                <LayoutTemplate /> Save as template…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={`/api/export/${pageId}`}>
              <Download /> Markdown
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/export/${pageId}?tree=1`}>
              <Download /> Markdown, with sub-pages
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/print/${pageId}`} target="_blank" rel="noreferrer">
              <Printer /> Print or save as PDF
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/print/${pageId}?tree=1`}
              target="_blank"
              rel="noreferrer"
            >
              <Printer /> Print, with sub-pages
            </a>
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Layout</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={fullWidth}
                onCheckedChange={(next) =>
                  startTransition(() =>
                    setPageLayout(pageId, { fullWidth: next }),
                  )
                }
              >
                Full width
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={smallText}
                onCheckedChange={(next) =>
                  startTransition(() =>
                    setPageLayout(pageId, { smallText: next }),
                  )
                }
              >
                Small text
              </DropdownMenuCheckboxItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setReported(false);
              setReason("");
              setReporting(true);
            }}
          >
            <Flag /> Report content…
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
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  aria-label="Public link"
                  className="min-w-0 flex-1 text-xs"
                />
                <CopyButton value={shareUrl} />
              </div>
              <DialogFooter>
                <ConfirmButton
                  size="sm"
                  disabled={isPending}
                  title="Revoke the public link?"
                  description="Anyone who has the link loses access straight away. You can create a new link later."
                  confirmLabel="Revoke link"
                  onConfirm={() => updateShare(false)}
                >
                  Revoke public link
                </ConfirmButton>
              </DialogFooter>
            </div>
          ) : (
            <DialogFooter>
              <Button disabled={isPending} onClick={() => updateShare(true)}>
                {isPending ? "Creating…" : "Create public read-only link"}
              </Button>
            </DialogFooter>
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
            <>
              <Notice variant="info" title="Report sent">
                <p>Thank you — it has been passed on for review.</p>
              </Notice>
              <DialogFooter>
                <Button type="button" onClick={() => setReporting(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  try {
                    await reportPage(pageId, reason);
                    setReported(true);
                  } catch (error) {
                    toast({
                      variant: "destructive",
                      title: "Couldn't send the report",
                      description:
                        error instanceof Error
                          ? error.message
                          : "Please try again.",
                    });
                  }
                });
              }}
            >
              <Field label="What's the problem?" htmlFor={reasonId}>
                <Textarea
                  id={reasonId}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReporting(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Sending…" : "Send report"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
