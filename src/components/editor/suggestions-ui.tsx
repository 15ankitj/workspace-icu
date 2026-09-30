"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockNoteEditor } from "@blocknote/core";
import { selectSuggestion } from "@handlewithcare/prosemirror-suggest-changes";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ListChecks,
  MessageSquare,
  Undo2,
  X,
} from "lucide-react";
import { addComment } from "@/app/actions/comments";
import { resolveSuggestion } from "@/app/actions/suggestions";
import {
  applyOutcome,
  spanLabel,
  type SuggestionSpan,
} from "@/components/editor/suggestions";
import { Badge } from "@/components/ui/badge";
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
import {
  excerptOf,
  isOwnSuggestion,
  kindTitle,
  statusLabel,
  suggesterName,
  type ResolveResult,
  type SuggestionOutcome,
  type SuggestionStatus,
} from "@/lib/suggestions";
import { formatRelative } from "@/lib/time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

/** A rationale or reply on a suggestion (the comment model, §2.5). */
export interface SuggestionNote {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export type SuggestionThreads = Record<string, SuggestionNote[]>;

export interface SuggestionActor {
  userId: string;
  /** Page author (creator or co-author): resolves without ceremony. */
  isAuthor: boolean;
  /** Workspace owner: may resolve on others' pages with a typed reason. */
  isOwner: boolean;
  members: { id: string; displayName: string }[];
}

/** A suggestion whose context an author's edit removed (§2.4). */
export interface StaleSuggestion {
  id: string;
  suggesterId: string;
  excerpt: string;
}

/** What the index holds about an open suggestion: who and when, no content. */
export interface SuggestionMeta {
  suggesterId: string;
  createdAt: string;
}

/** A resolved suggestion, for the read-only "Resolved" section. */
export interface ResolvedSuggestion {
  id: string;
  kind: string;
  excerpt: string;
  status: Exclude<SuggestionStatus, "open">;
  suggesterId: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  ownerOverride: boolean;
}

/** Hooks for the host of a resolution (the page editor). */
export interface ResolveCallbacks {
  /** The click landed: hide any prompt for this suggestion now. */
  onResolving?: (id: string) => void;
  /** The record holds `status` (which on a repeat is the earlier outcome). */
  onResolved?: (
    id: string,
    status: SuggestionStatus,
    detail: { outcome: SuggestionOutcome; ownerOverride: boolean },
  ) => void;
  /** The document has been converged to the recorded status. */
  onApplied?: (id: string) => void;
}

export interface ResolveFailure {
  id: string;
  error: string;
}

/** The chip's target: a span and where to draw next to it. */
export interface ActiveSuggestion {
  span: SuggestionSpan;
  position: { left: number; top: number };
}

/**
 * The suggestion under the caret, cleared the moment its span leaves the
 * document — so a chip can never outlive the suggestion it offers, no
 * matter whether the caret moved.
 */
export function useActiveSuggestion(spans: SuggestionSpan[]) {
  const [active, setActive] = useState<ActiveSuggestion | null>(null);
  // Derived, not synchronised: the moment the span is gone from the
  // document the chip is gone, in the same render, whatever the caret did.
  const present =
    active && spans.some((s) => s.id === active.span.id) ? active : null;
  return [present, setActive] as const;
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Resolution shared by the chip, the review list and the stale section
 * (Appendix A §2.3): record first — that is where permission lives — then
 * converge the document to the status the record reports, whatever
 * outcome was asked for. A repeat therefore silently removes lingering
 * marks and the prompt goes; a refusal is shown in the server's own
 * words and the item stays. A workspace owner who is not the author is
 * asked for a reason.
 */
export function useResolve(
  editor: AnyEditor,
  pageId: string,
  actor: SuggestionActor,
  callbacks: ResolveCallbacks = {},
) {
  const [askReason, setAskReason] = useState<{
    ids: string[];
    outcome: "accepted" | "rejected";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<{
    ids: Set<string>;
    outcome: SuggestionOutcome;
  } | null>(null);

  const run = async (
    ids: string[],
    outcome: SuggestionOutcome,
    why?: string,
  ): Promise<ResolveFailure[]> => {
    setBusy({ ids: new Set(ids), outcome });
    const failures: ResolveFailure[] = [];
    const ownerOverride = why !== undefined;
    for (const id of ids) {
      callbacks.onResolving?.(id);
      let result: ResolveResult;
      try {
        result = await resolveSuggestion(pageId, id, outcome, why);
      } catch (error) {
        if (isRedirect(error)) throw error;
        result = {
          ok: false,
          error: error instanceof Error ? error.message : "Please try again.",
        };
      }
      if (!result.ok) {
        failures.push({ id, error: result.error });
        continue;
      }
      callbacks.onResolved?.(id, result.status, { outcome, ownerOverride });
      applyOutcome(editor, id, result.status);
      callbacks.onApplied?.(id);
    }
    setBusy(null);
    if (failures.length > 0) {
      const messages = [...new Set(failures.map((f) => f.error))].join("; ");
      toast({
        variant: "destructive",
        title:
          ids.length === 1
            ? "Could not resolve suggestion"
            : `${failures.length} of ${ids.length} could not be resolved`,
        description: messages,
      });
    } else if (ids.length > 1) {
      toast({ title: `${ids.length} suggestions ${outcome}` });
    }
    return failures;
  };

  const resolve = (ids: string[], outcome: SuggestionOutcome) => {
    if (ids.length === 0) return;
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
            disabled={busy !== null}
            onClick={() => setAskReason(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={
              askReason.outcome === "accepted" ? "default" : "destructive"
            }
            disabled={busy !== null || reason.trim().length < 3}
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

  /** The label a button shows for `id` while its outcome is in flight. */
  const pendingLabel = (id: string, outcome: SuggestionOutcome) =>
    busy?.ids.has(id) && busy.outcome === outcome
      ? {
          accepted: "Accepting…",
          rejected: "Rejecting…",
          withdrawn: "Withdrawing…",
        }[outcome]
      : null;

  return { resolve, busy: busy !== null, pendingLabel, reasonDialog };
}

/** Select a suggestion in the editor and bring it into view. */
export function locateSuggestion(editor: AnyEditor, id: string) {
  const view = editor.prosemirrorView;
  if (view.isDestroyed) return;
  selectSuggestion(id)(view.state, view.dispatch);
  view.dispatch(view.state.tr.scrollIntoView());
  view.focus();
}

function describe(span: SuggestionSpan, max = 60): React.ReactNode {
  if (span.change) {
    return (
      <>
        <span className="line-through decoration-muted-foreground/60">
          {excerptOf(span.change.previous, max) || <em>empty</em>}
        </span>
        {" → "}
        {excerptOf(span.change.next, max) || <em>empty</em>}
      </>
    );
  }
  return excerptOf(span.text, max) || <em>formatting</em>;
}

/** Accept / Reject for those who may, Withdraw for the suggester. */
function SuggestionActions({
  id,
  mine,
  canResolve,
  busy,
  pendingLabel,
  onResolve,
  compact = false,
}: {
  id: string;
  mine: boolean;
  canResolve: boolean;
  busy: boolean;
  pendingLabel: (id: string, outcome: SuggestionOutcome) => string | null;
  onResolve: (id: string, outcome: SuggestionOutcome) => void;
  compact?: boolean;
}) {
  const cls = compact ? "h-6 px-1.5" : "h-7 px-2";
  const icon = compact ? "size-3.5" : "size-3.5";
  return (
    <>
      {canResolve && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className={cls}
            disabled={busy}
            onClick={() => onResolve(id, "accepted")}
            title="Accept this suggestion"
          >
            <Check className={icon} aria-hidden />{" "}
            {pendingLabel(id, "accepted") ?? "Accept"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cls}
            disabled={busy}
            onClick={() => onResolve(id, "rejected")}
            title="Reject this suggestion"
          >
            <X className={icon} aria-hidden />{" "}
            {pendingLabel(id, "rejected") ?? "Reject"}
          </Button>
        </>
      )}
      {mine && (
        <Button
          size="sm"
          variant="ghost"
          className={cls}
          disabled={busy}
          onClick={() => onResolve(id, "withdrawn")}
          title="Withdraw your suggestion"
        >
          <Undo2 className={icon} aria-hidden />{" "}
          {pendingLabel(id, "withdrawn") ?? "Withdraw"}
        </Button>
      )}
    </>
  );
}

/**
 * The compact chip anchored to the suggestion under the caret. Its host
 * keeps it with {@link useActiveSuggestion}, so it is gone the moment
 * the suggestion is; it never waits for the caret to move.
 */
export function SuggestionChip({
  editor,
  pageId,
  actor,
  span,
  position,
  noteCount = 0,
  callbacks,
}: {
  editor: AnyEditor;
  pageId: string;
  actor: SuggestionActor;
  span: SuggestionSpan;
  /** Container-relative pixel position of the span's start. */
  position: { left: number; top: number };
  noteCount?: number;
  callbacks?: ResolveCallbacks;
}) {
  const { resolve, busy, pendingLabel, reasonDialog } = useResolve(
    editor,
    pageId,
    actor,
    callbacks,
  );
  const name = suggesterName(span.id, actor.members);
  const mine = isOwnSuggestion(span.id, actor.userId);
  const canResolve = actor.isAuthor || actor.isOwner;
  return (
    <>
      <div
        contentEditable={false}
        data-suggestion-chip={span.id}
        className="absolute z-20 flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs shadow-md"
        style={{ left: position.left, top: position.top }}
      >
        <span className="text-muted-foreground">
          {spanLabel(span)} · {mine ? "you" : (name ?? "a colleague")}
          {noteCount ? ` · ${noteCount} note${noteCount === 1 ? "" : "s"}` : ""}
        </span>
        <SuggestionActions
          id={span.id}
          mine={mine}
          canResolve={canResolve}
          busy={busy}
          pendingLabel={pendingLabel}
          onResolve={(id, outcome) => resolve([id], outcome)}
          compact
        />
      </div>
      {reasonDialog}
    </>
  );
}

/** @deprecated Renamed {@link SuggestionChip}. */
export const SuggestionPopover = SuggestionChip;

/**
 * The page's suggestions: a header with the count, Next / Previous and
 * Accept all / Reject all; the review list, one row per open suggestion;
 * the context-changed section; and a collapsed record of what was last
 * resolved here. The rows come from the document's marks (`spans`); the
 * index (`meta`, `resolved`) only adds who, when and what happened.
 */
export function SuggestionsBar({
  editor,
  workspaceId,
  pageId,
  actor,
  spans,
  threads,
  stale = [],
  meta = {},
  resolved = [],
  activeId = null,
  callbacks,
}: {
  editor: AnyEditor;
  workspaceId: string;
  pageId: string;
  actor: SuggestionActor;
  spans: SuggestionSpan[];
  threads: SuggestionThreads;
  stale?: StaleSuggestion[];
  /** Index rows for open suggestions, by id. */
  meta?: Record<string, SuggestionMeta>;
  /** The last few resolved suggestions on this page, newest first. */
  resolved?: ResolvedSuggestion[];
  /** The suggestion under the caret, for "k of n" and Next / Previous. */
  activeId?: string | null;
  callbacks?: ResolveCallbacks;
}) {
  const [open, setOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const { resolve, busy, pendingLabel, reasonDialog } = useResolve(
    editor,
    pageId,
    actor,
    callbacks,
  );
  if (spans.length === 0 && stale.length === 0 && resolved.length === 0) {
    return null;
  }
  const canResolve = actor.isAuthor || actor.isOwner;
  const count = spans.length;
  const index = activeId ? spans.findIndex((s) => s.id === activeId) : -1;
  const step = (delta: 1 | -1) => {
    if (count === 0) return;
    const next =
      index < 0
        ? delta === 1
          ? 0
          : count - 1
        : (index + delta + count) % count;
    locateSuggestion(editor, spans[next].id);
  };
  const nameOf = (userId: string) =>
    userId === actor.userId
      ? "you"
      : (actor.members.find((m) => m.id === userId)?.displayName ??
        "a colleague");

  return (
    <div className="mb-3 rounded-md border bg-card text-sm">
      {stale.length > 0 && (
        <div className="border-b px-3 py-2">
          <p className="font-medium">
            Context changed · {stale.length} suggestion
            {stale.length === 1 ? "" : "s"} no longer appl
            {stale.length === 1 ? "ies" : "y"}
          </p>
          <p className="text-xs text-muted-foreground">
            The text they proposed to change was edited. They cannot be applied;
            the suggester can withdraw, an author can dismiss.
          </p>
          <ul className="mt-1 space-y-1">
            {stale.map((item) => {
              const mine = item.suggesterId === actor.userId;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="mr-2 text-xs text-muted-foreground">
                      {nameOf(item.suggesterId)}
                    </span>
                    {item.excerpt || <em>formatting</em>}
                  </span>
                  {mine && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={busy}
                      onClick={() => resolve([item.id], "withdrawn")}
                    >
                      {pendingLabel(item.id, "withdrawn") ?? "Withdraw"}
                    </Button>
                  )}
                  {canResolve && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={busy}
                      onClick={() => resolve([item.id], "rejected")}
                    >
                      {pendingLabel(item.id, "rejected") ?? "Dismiss"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <ListChecks className="size-4 text-muted-foreground" aria-hidden />
        <span>
          {count === 0
            ? "No open suggestions"
            : `${count} open suggestion${count === 1 ? "" : "s"}`}
        </span>
        {count > 0 && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide" : "Review"}
            </Button>
            <span className="flex items-center gap-0.5">
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7"
                aria-label="Previous suggestion"
                title="Previous suggestion"
                onClick={() => step(-1)}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span className="min-w-8 text-center text-xs tabular-nums text-muted-foreground">
                {index >= 0 ? `${index + 1} of ${count}` : `— of ${count}`}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7"
                aria-label="Next suggestion"
                title="Next suggestion"
                onClick={() => step(1)}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </span>
          </>
        )}
        {canResolve && count > 0 && (
          <span className="ml-auto flex gap-1">
            <ConfirmButton
              size="sm"
              variant="secondary"
              className="h-7"
              title={`Accept all ${count} suggestion${count === 1 ? "" : "s"}?`}
              description="Every proposed insertion is kept and every proposed deletion is applied. This is recorded per suggestion."
              confirmLabel={`Accept ${count}`}
              onConfirm={() =>
                resolve(
                  spans.map((s) => s.id),
                  "accepted",
                )
              }
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
              onConfirm={() =>
                resolve(
                  spans.map((s) => s.id),
                  "rejected",
                )
              }
              disabled={busy}
            >
              Reject all
            </ConfirmButton>
          </span>
        )}
      </div>
      {open && count > 0 && (
        <ul className="divide-y border-t" data-suggestion-list>
          {spans.map((span) => {
            const mine = isOwnSuggestion(span.id, actor.userId);
            const row = meta[span.id];
            const name = row
              ? nameOf(row.suggesterId)
              : mine
                ? "you"
                : (suggesterName(span.id, actor.members) ?? "a colleague");
            const notes = threads[span.id] ?? [];
            return (
              <li
                key={span.id}
                data-suggestion-row={span.id}
                className={
                  span.id === activeId
                    ? "bg-muted/40 px-3 py-1.5"
                    : "px-3 py-1.5"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="shrink-0">
                    {spanLabel(span)}
                  </Badge>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    title="Show in the page"
                    onClick={() => locateSuggestion(editor, span.id)}
                  >
                    {describe(span)}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {name}
                    {row ? ` · ${formatRelative(row.createdAt)}` : ""}
                  </span>
                  <SuggestionActions
                    id={span.id}
                    mine={mine}
                    canResolve={canResolve}
                    busy={busy}
                    pendingLabel={pendingLabel}
                    onResolve={(id, outcome) => resolve([id], outcome)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground"
                    aria-expanded={openThread === span.id}
                    onClick={() =>
                      setOpenThread((current) =>
                        current === span.id ? null : span.id,
                      )
                    }
                    title={
                      mine
                        ? "Explain your suggestion"
                        : "Discuss this suggestion"
                    }
                  >
                    <MessageSquare className="size-3.5" aria-hidden />
                    {notes.length > 0
                      ? notes.length
                      : mine
                        ? "Add note"
                        : "Reply"}
                  </Button>
                </div>
                {openThread === span.id && (
                  <SuggestionThread
                    workspaceId={workspaceId}
                    pageId={pageId}
                    suggestionId={span.id}
                    notes={notes}
                    mine={mine}
                    currentUserId={actor.userId}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {resolved.length > 0 && (
        <div className="border-t px-3 py-1.5">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showResolved}
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
            Resolved ({resolved.length})
          </button>
          {showResolved && (
            <ul className="mt-1 space-y-1" data-suggestion-resolved>
              {resolved.slice(0, 10).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <Badge variant="outline" className="shrink-0">
                    {kindTitle(item.kind)}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {item.excerpt || <em>formatting</em>}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {statusLabel(item.status)}
                    {item.resolvedBy ? ` by ${nameOf(item.resolvedBy)}` : ""}
                    {item.ownerOverride ? " (owner override)" : ""}
                    {item.resolvedAt
                      ? ` · ${formatRelative(item.resolvedAt)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {reasonDialog}
    </div>
  );
}

/** The rationale thread under one suggestion: notes so far, and a box. */
function SuggestionThread({
  workspaceId,
  pageId,
  suggestionId,
  notes,
  mine,
  currentUserId,
}: {
  workspaceId: string;
  pageId: string;
  suggestionId: string;
  notes: SuggestionNote[];
  mine: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      await addComment(workspaceId, pageId, value, suggestionId);
      setText("");
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not add the note",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1 space-y-2 rounded-md bg-muted/40 p-2">
      {notes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {mine
            ? "Say why you are proposing this — the author sees it with the change."
            : "No note yet. Ask a question or explain your decision."}
        </p>
      )}
      <ul className="space-y-1">
        {notes.map((note) => (
          <li key={note.id} className="text-sm">
            <span className="font-medium">
              {note.authorId === currentUserId ? "You" : note.authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {" "}
              ·{" "}
              {new Date(note.createdAt).toLocaleString("en-GB", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <span className="block whitespace-pre-wrap">{note.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={text}
          placeholder={mine && notes.length === 0 ? "Rationale" : "Reply"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
          }}
        />
        <Button size="sm" disabled={busy || !text.trim()} onClick={submit}>
          {busy ? "Sending…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
