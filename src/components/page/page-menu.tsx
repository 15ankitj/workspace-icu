"use client";

import { useId, useState, useTransition } from "react";
import {
  Download,
  Flag,
  LayoutTemplate,
  Link2,
  MoreHorizontal,
  Printer,
  PenLine,
} from "lucide-react";
import { setPageLayout } from "@/app/actions/pages";
import { reportPage } from "@/app/actions/reports";
import { setPublicLink } from "@/app/actions/shares";
import { SaveTemplateDialog } from "@/components/page/save-template-dialog";
import { AuthorshipDialog } from "@/components/page/authorship-dialog";
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
  unresolvedSuggestions = 0,
  authorship,
}: {
  pageId: string;
  workspaceId: string;
  fullWidth: boolean;
  smallText: boolean;
  canEdit: boolean;
  share: ShareState | null;
  isPlatformOwner: boolean;
  /** Suggestions still waiting on this page: clean exports leave them out
   *  (Appendix A §2.4), so the menu says so. */
  unresolvedSuggestions?: number;
  /** Authored content (Appendix A §2.2); null when this user may not set it. */
  authorship?: {
    creatorId: string;
    authored: boolean;
    coAuthors: string[];
    members: { id: string; displayName: string }[];
  } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [authoring, setAuthoring] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Exports are the clean state unless asked for markup (Appendix A §2.4).
  const [withMarkup, setWithMarkup] = useState(false);
  const exportQuery = (tree: boolean) => {
    const params = new URLSearchParams();
    if (tree) params.set("tree", "1");
    if (withMarkup) params.set("markup", "1");
    const q = params.toString();
    return q ? `?${q}` : "";
  };
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
              {authorship && (
                <DropdownMenuItem onSelect={() => setAuthoring(true)}>
                  <PenLine /> Authorship…
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={`/api/export/${pageId}${exportQuery(false)}`}>
              <Download /> Markdown
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/export/${pageId}${exportQuery(true)}`}>
              <Download /> Markdown, with sub-pages
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/print/${pageId}${exportQuery(false)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Printer /> Print or save as PDF
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/print/${pageId}${exportQuery(true)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Printer /> Print, with sub-pages
            </a>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={withMarkup}
            onCheckedChange={(next) => setWithMarkup(next === true)}
            onSelect={(event) => event.preventDefault()}
          >
            Include suggestion markup
          </DropdownMenuCheckboxItem>
          {unresolvedSuggestions > 0 && (
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">
              {unresolvedSuggestions} suggestion
              {unresolvedSuggestions === 1 ? "" : "s"} still waiting here.
              {withMarkup
                ? " Exports will show them as markup."
                : " Clean exports leave them out."}
            </p>
          )}
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

      {authorship && (
        <AuthorshipDialog
          open={authoring}
          onOpenChange={setAuthoring}
          workspaceId={workspaceId}
          pageId={pageId}
          creatorId={authorship.creatorId}
          authored={authorship.authored}
          coAuthors={authorship.coAuthors}
          members={authorship.members}
        />
      )}
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
