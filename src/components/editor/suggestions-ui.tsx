"use client";

import { useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { selectSuggestion } from "@handlewithcare/prosemirror-suggest-changes";
import { Check, ListChecks, Undo2, X } from "lucide-react";
import { resolveSuggestion } from "@/app/actions/suggestions";
import {
  resolveAllInDocument,
  resolveInDocument,
  type SuggestionSpan,
} from "@/components/editor/suggestions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { excerptOf, isOwnSuggestion, suggesterName } from "@/lib/suggestions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

export interface SuggestionActor {
  userId: string;
  /** Page author (creator or co-author): resolves without ceremony. */
  isAuthor: boolean;
  /** Workspace owner: may resolve on others' pages with a typed reason. */
  isOwner: boolean;
  members: { id: string; displayName: string }[];
}

type Outcome = "accepted" | "rejected" | "withdrawn";

function kindLabel(span: SuggestionSpan) {
  return span.kind === "insertion"
    ? "Insert"
    : span.kind === "deletion"
      ? "Delete"
      : "Change";
}

/**
 * Resolution shared by the popover and the bar (Appendix A §2.3). The
 * server records the outcome first — that is where permission lives —
 * then the document applies it, which every open client sees through
 * Yjs. A workspace owner who is not the author is asked for a reason.
 */
function useResolve(editor: AnyEditor, pageId: string, actor: SuggestionActor) {
  const [askReason, setAskReason] = useState<{
    ids: string[];
    outcome: "accepted" | "rejected";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (ids: string[], outcome: Outcome, why?: string) => {
    setBusy(true);
    let done = 0;
    for (const id of ids) {
      try {
        await resolveSuggestion(pageId, id, outcome, why);
        const ok = resolveInDocument(
          editor,
          id,
          outcome === "accepted" ? "accept" : "revert",
        );
        if (!ok) {
          toast({
            title: "Recorded, but the text has moved",
            description:
              "The suggestion was resolved in the record; its context changed, so check the page.",
          });
        }
        done += 1;
      } catch (error) {
        toast({
          title: "Could not resolve suggestion",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "destructive",
        });
        break;
      }
    }
    setBusy(false);
    return done;
  };

  const resolve = (ids: string[], outcome: Outcome) => {
    if (outcome !== "withdrawn" && !actor.isAuthor && actor.isOwner) {
      setReason("");
      setAskReason({ ids, outcome });
      return;
    }
    void run(ids, outcome);
  };

  const reasonDialog = askReason && (
    <Dialog open onOpenChange={(open) => !open && !busy && setAskReason(null)}>
      <DialogContent>
        <DialogTitle>
          {askReason.outcome === "accepted" ? "Accept" : "Reject"} on the
          author&apos;s behalf
        </DialogTitle>
        <DialogDescription>
          You are not this page&apos;s author. Owners may resolve suggestions as
          a safety valve; say why, and it is recorded with the decision.
        </DialogDescription>
        <Textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Candidate has left the programme; closing their file"
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setAskReason(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={
              askReason.outcome === "accepted" ? "default" : "destructive"
            }
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              const { ids, outcome } = askReason;
              await run(ids, outcome, reason.trim());
              setAskReason(null);
            }}
          >
            {busy
              ? "Working…"
              : `${askReason.outcome === "accepted" ? "Accept" : "Reject"} ${askReason.ids.length > 1 ? `${askReason.ids.length} suggestions` : "suggestion"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { resolve, busy, reasonDialog };
}

/** Floating actions for the suggestion under the caret. */
export function SuggestionPopover({
  editor,
  pageId,
  actor,
  span,
  position,
}: {
  editor: AnyEditor;
  pageId: string;
  actor: SuggestionActor;
  span: SuggestionSpan;
  /** Container-relative pixel position of the span's start. */
  position: { left: number; top: number };
}) {
  const { resolve, busy, reasonDialog } = useResolve(editor, pageId, actor);
  const name = suggesterName(span.id, actor.members);
  const mine = isOwnSuggestion(span.id, actor.userId);
  const canResolve = actor.isAuthor || actor.isOwner;
  return (
    <>
      <div
        contentEditable={false}
        className="absolute z-20 flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs shadow-md"
        style={{ left: position.left, top: position.top }}
      >
        <span className="text-muted-foreground">
          {kindLabel(span)} · {mine ? "you" : (name ?? "a colleague")}
        </span>
        {canResolve && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5"
              disabled={busy}
              onClick={() => resolve([span.id], "accepted")}
              title="Accept this suggestion"
            >
              <Check className="size-3.5" aria-hidden /> Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5"
              disabled={busy}
              onClick={() => resolve([span.id], "rejected")}
              title="Reject this suggestion"
            >
              <X className="size-3.5" aria-hidden /> Reject
            </Button>
          </>
        )}
        {mine && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5"
            disabled={busy}
            onClick={() => resolve([span.id], "withdrawn")}
            title="Withdraw your suggestion"
          >
            <Undo2 className="size-3.5" aria-hidden /> Withdraw
          </Button>
        )}
      </div>
      {reasonDialog}
    </>
  );
}

/** The page's open suggestions: count, review list, accept/reject all. */
export function SuggestionsBar({
  editor,
  pageId,
  actor,
  spans,
}: {
  editor: AnyEditor;
  pageId: string;
  actor: SuggestionActor;
  spans: SuggestionSpan[];
}) {
  const [open, setOpen] = useState(false);
  const { resolve, busy, reasonDialog } = useResolve(editor, pageId, actor);
  if (spans.length === 0) return null;
  const canResolve = actor.isAuthor || actor.isOwner;
  const count = spans.length;

  const resolveAll = async (outcome: "accepted" | "rejected") => {
    if (!actor.isAuthor && actor.isOwner) {
      resolve(
        spans.map((s) => s.id),
        outcome,
      );
      return;
    }
    // Authors: one round trip per suggestion for the audit pair, then
    // one document change for all.
    for (const span of spans) {
      try {
        await resolveSuggestion(pageId, span.id, outcome);
      } catch (error) {
        toast({
          title: "Could not resolve every suggestion",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "destructive",
        });
        return;
      }
    }
    resolveAllInDocument(editor, outcome === "accepted" ? "accept" : "revert");
    toast({
      title: `${count} suggestion${count === 1 ? "" : "s"} ${outcome}`,
    });
  };

  return (
    <div className="mb-3 rounded-md border bg-card text-sm">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <ListChecks className="size-4 text-muted-foreground" aria-hidden />
        <span>
          {count} open suggestion{count === 1 ? "" : "s"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Review"}
        </Button>
        {canResolve && (
          <span className="ml-auto flex gap-1">
            <ConfirmButton
              size="sm"
              variant="secondary"
              className="h-7"
              title={`Accept all ${count} suggestion${count === 1 ? "" : "s"}?`}
              description="Every proposed insertion is kept and every proposed deletion is applied. This is recorded per suggestion."
              confirmLabel={`Accept ${count}`}
              onConfirm={() => void resolveAll("accepted")}
              disabled={busy}
            >
              Accept all
            </ConfirmButton>
            <ConfirmButton
              size="sm"
              variant="outline"
              className="h-7"
              title={`Reject all ${count} suggestion${count === 1 ? "" : "s"}?`}
              description="Every proposed change is discarded and the page returns to its current text. This is recorded per suggestion."
              confirmLabel={`Reject ${count}`}
              onConfirm={() => void resolveAll("rejected")}
              disabled={busy}
            >
              Reject all
            </ConfirmButton>
          </span>
        )}
      </div>
      {open && (
        <ul className="divide-y border-t">
          {spans.map((span) => {
            const mine = isOwnSuggestion(span.id, actor.userId);
            const name = suggesterName(span.id, actor.members);
            return (
              <li
                key={span.id}
                className="flex flex-wrap items-center gap-2 px-3 py-1.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left hover:underline"
                  title="Show in the page"
                  onClick={() => {
                    const view = editor.prosemirrorView;
                    selectSuggestion(span.id)(view.state, view.dispatch);
                    view.focus();
                  }}
                >
                  <span className="mr-2 text-xs text-muted-foreground">
                    {kindLabel(span)} · {mine ? "you" : (name ?? "a colleague")}
                  </span>
                  {excerptOf(span.text) || <em>formatting</em>}
                </button>
                {canResolve && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={busy}
                      onClick={() => resolve([span.id], "accepted")}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={busy}
                      onClick={() => resolve([span.id], "rejected")}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {mine && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    disabled={busy}
                    onClick={() => resolve([span.id], "withdrawn")}
                  >
                    Withdraw
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {reasonDialog}
    </div>
  );
}
