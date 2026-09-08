"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/shadcn";
import { Copy, ExternalLink, Lock, RefreshCw, Repeat2 } from "lucide-react";
import {
  listSyncedBlocks,
  loadSyncedBlock,
  saveSyncedBlock,
  type SyncedBlockSummary,
  type SyncedBlockView,
} from "@/app/actions/synced";
import { Blocks } from "@/components/render/blocks-renderer";
import { innerSchema } from "@/components/editor/inner-schema";
import {
  SuggestionsExtension,
  cleanDocument,
  coordsOf,
  installSuggestDispatch,
  listSuggestions,
  setSuggesting,
  suggestionAtSelection,
  type SuggestionSpan,
} from "@/components/editor/suggestions";
import { SuggestionPopover } from "@/components/editor/suggestions-ui";
import { registerSuggestions } from "@/app/actions/suggestions";
import { excerptOf, isOwnSuggestion } from "@/lib/suggestions";
import {
  acquireRoom,
  releaseRoom,
  type CollabRoom,
} from "@/components/editor/collab-room";
import { usePageLinkContext } from "@/components/editor/page-link-context";
import { useSyncedHost } from "@/components/editor/synced-host-context";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { EditorBlock } from "@/lib/blocks";
import { bytesToBase64 } from "@/lib/collab";
import { roomIdForSyncedBlock, syncedClipboardText } from "@/lib/synced";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 1500;

/* ------------------------------------------------------------------ */
/* Picker: an empty placement chooses which synced block to show.      */
/* ------------------------------------------------------------------ */

function SyncedPicker({
  onSelect,
}: {
  onSelect: (item: SyncedBlockSummary) => void;
}) {
  const { workspaceId } = useSyncedHost();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SyncedBlockSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSyncedBlocks(workspaceId)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const matches = (items ?? [])
    .filter((item) =>
      `${item.title} ${item.sourceTitle}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 8);

  return (
    <div
      contentEditable={false}
      className="rounded-md border border-dashed p-2"
    >
      <Input
        autoFocus
        value={query}
        placeholder="Insert a synced block…"
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="mt-1 max-h-56 overflow-y-auto">
        {items === null && (
          <li className="px-2 py-1 text-xs text-muted-foreground">Loading…</li>
        )}
        {matches.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full flex-col items-start rounded px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(item)}
            >
              <span className="truncate font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">
                {item.sourceIcon ? `${item.sourceIcon} ` : ""}
                {item.sourceTitle || "Untitled"} · appears in {item.placements}{" "}
                page{item.placements === 1 ? "" : "s"}
              </span>
            </button>
          </li>
        ))}
        {items !== null && matches.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            {items.length === 0
              ? "No synced blocks yet. Use “Turn into synced block” on any block's ⋮⋮ menu."
              : "No matching synced blocks."}
          </li>
        )}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Placeholders (Appendix A §1.3 rules 3, 4, 7).                        */
/* ------------------------------------------------------------------ */

function Placeholder({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      contentEditable={false}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
    >
      <span>
        <Repeat2
          className="mr-1.5 inline size-4 align-text-bottom"
          aria-hidden
        />
        {children}
      </span>
      {actions && (
        <span className="flex shrink-0 gap-3 text-xs">{actions}</span>
      )}
    </div>
  );
}

/** "Remove here" on a placeholder: the host page drops its placement. */
function RemoveAction({ onDetach }: { onDetach: (() => void) | null }) {
  if (!onDetach) return null;
  return (
    <button
      type="button"
      className="hover:text-foreground"
      title="Remove this placement from this page"
      onClick={onDetach}
    >
      Remove here
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Live placement: a nested collaborative editor on the synced block's  */
/* own document.                                                        */
/* ------------------------------------------------------------------ */

function LiveContent({
  view,
  hostPageId,
  editable,
  suggesting,
  collab,
}: {
  view: SyncedBlockView;
  hostPageId: string;
  /** Direct editing (author of an authored source, or any editor of a
   *  plain one). */
  editable: boolean;
  /** Authored source, this user is not its author: edits become
   *  suggestions on the source page (Appendix A §2.5). */
  suggesting: boolean;
  collab: { userName: string; userColour: string };
}) {
  const host = useSyncedHost();
  const canType = editable || suggesting;
  const roomId = roomIdForSyncedBlock(view.id);
  const [spans, setSpans] = useState<SuggestionSpan[]>([]);
  const [active, setActive] = useState<{
    span: SuggestionSpan;
    position: { left: number; top: number };
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const knownSuggestions = useRef<Set<string> | null>(null);
  const registerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [room] = useState<CollabRoom>(() =>
    acquireRoom(roomId, view.storedStateBase64),
  );
  useEffect(() => {
    acquireRoom(roomId, view.storedStateBase64);
    return () => {
      releaseRoom(roomId);
      releaseRoom(roomId);
    };
    // Bound for this component instance's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useCreateBlockNote(
    {
      schema: innerSchema,
      extensions: [
        SuggestionsExtension(),
        CollaborationExtension({
          fragment: room.fragment,
          user: { name: collab.userName, color: collab.userColour },
          provider: {
            awareness: room.provider.awareness as unknown as Awareness,
          },
          showCursorLabels: "activity",
        }),
      ],
    },
    [view.id],
  );

  // Seed a room that is empty after its first sync from the stored
  // projection (a synced block just created, or written before its room
  // was ever opened), once, by an editor who may write.
  const seeded = useRef(false);
  useEffect(() => {
    if (!canType || seeded.current) return;
    let cancelled = false;
    void room.synced.then(() => {
      if (cancelled || seeded.current) return;
      seeded.current = true;
      if (room.fragment.length === 0 && view.blocks.length > 0) {
        editor.replaceBlocks(
          editor.document,
          view.blocks as unknown as (typeof innerSchema)["PartialBlock"][],
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [room, editor, canType, view.blocks]);

  // Suggest mode inside the placement: this user's transactions become
  // marks in the synced document, indexed under the *source* page.
  const actor = host.actor;
  useEffect(() => {
    if (!suggesting || !actor) return;
    let uninstall: (() => void) | null = null;
    try {
      uninstall = installSuggestDispatch(editor, actor.userId);
      setSuggesting(editor, true);
    } catch (error) {
      console.error("Suggest mode unavailable in placement:", error);
    }
    return () => {
      try {
        uninstall?.();
      } catch {
        // View already gone.
      }
    };
  }, [editor, suggesting, actor]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  useEffect(() => {
    if (!canType) return;
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      let blocks: EditorBlock[];
      try {
        blocks = cleanDocument(editor);
      } catch {
        return;
      }
      saveSyncedBlock(
        view.id,
        bytesToBase64(Y.encodeStateAsUpdate(room.doc)),
        blocks,
        hostPageId,
      ).catch((error) => {
        dirty.current = true;
        // A suggester's save may carry the author's unsaved edits; the
        // author's client lands them shortly, so retry quietly.
        if (
          suggesting &&
          error instanceof Error &&
          error.message.includes("authored_content")
        ) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(flush, 4000);
          return;
        }
        console.error("Failed to save synced block:", error);
        toast({
          title: "Synced block not saved",
          description:
            "Your edit is still on screen. Retrying on the next change.",
          variant: "destructive",
        });
      });
    };
    const trackSuggestions = () => {
      let current: SuggestionSpan[];
      try {
        current = listSuggestions(editor.prosemirrorState.doc);
      } catch {
        return;
      }
      setSpans(current);
      if (!knownSuggestions.current) {
        knownSuggestions.current = new Set(current.map((s) => s.id));
        return;
      }
      if (!actor || !view.sourcePageId) return;
      const fresh = current.filter(
        (s) =>
          !knownSuggestions.current!.has(s.id) &&
          isOwnSuggestion(s.id, actor.userId),
      );
      if (fresh.length === 0) return;
      if (registerTimer.current) clearTimeout(registerTimer.current);
      registerTimer.current = setTimeout(() => {
        const latest = listSuggestions(editor.prosemirrorState.doc);
        const items = latest
          .filter(
            (s) =>
              !knownSuggestions.current!.has(s.id) &&
              isOwnSuggestion(s.id, actor.userId),
          )
          .map((s) => ({ id: s.id, kind: s.kind, excerpt: excerptOf(s.text) }));
        for (const item of items) knownSuggestions.current!.add(item.id);
        if (items.length > 0 && view.sourcePageId) {
          registerSuggestions(view.sourcePageId, items).catch((error) =>
            console.error("Failed to record suggestions:", error),
          );
        }
      }, 2000);
    };
    trackSuggestions();
    const unsubscribe = editor.onChange(() => {
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
      trackSuggestions();
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (registerTimer.current) clearTimeout(registerTimer.current);
      try {
        flush();
      } catch (error) {
        console.warn("Final synced save skipped:", error);
      }
    };
  }, [
    editor,
    room,
    canType,
    suggesting,
    actor,
    view.id,
    view.sourcePageId,
    hostPageId,
  ]);

  // Accept / reject / withdraw for the suggestion under the caret, with
  // the source page's authorship deciding who may.
  useEffect(() => {
    if (!actor) return;
    const unsubscribe = editor.onSelectionChange(() => {
      const span = suggestionAtSelection(editor, spans);
      const container = containerRef.current;
      const coords = span ? coordsOf(editor, span.from) : null;
      if (!span || !container || !coords) {
        setActive(null);
        return;
      }
      const box = container.getBoundingClientRect();
      setActive({
        span,
        position: {
          left: Math.max(0, coords.left - box.left),
          top: Math.max(0, coords.top - box.top - 34),
        },
      });
    }, true);
    return () => unsubscribe?.();
  }, [editor, spans, actor]);

  return (
    <div ref={containerRef} className="relative">
      {active && actor && view.sourcePageId && (
        <SuggestionPopover
          key={active.span.id}
          editor={editor}
          pageId={view.sourcePageId}
          actor={{ ...actor, isAuthor: view.sourceIsAuthor }}
          span={active.span}
          position={active.position}
        />
      )}
      <BlockNoteView
        editor={editor}
        editable={canType}
        sideMenu={false}
        slashMenu={canType}
        formattingToolbar={canType}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The placement: chrome, state and the choice of live vs snapshot.    */
/* ------------------------------------------------------------------ */

function SyncedPlacement({
  syncedBlockId,
  readOnly,
  onToggleReadOnly,
  onDetach,
}: {
  syncedBlockId: string;
  readOnly: boolean;
  onToggleReadOnly: (() => void) | null;
  onDetach: (() => void) | null;
}) {
  const host = useSyncedHost();
  const { workspaceId } = usePageLinkContext();
  const [view, setView] = useState<SyncedBlockView | null | undefined>(
    undefined,
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSyncedBlock(syncedBlockId)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch(() => {
        if (!cancelled) setView(null);
      });
    return () => {
      cancelled = true;
    };
  }, [syncedBlockId, reloadKey]);

  // A placement on its own source page tells the editor, so removing it
  // later is treated as removing the source (rule 6).
  useEffect(() => {
    if (view && !view.tombstone && view.sourcePageId === host.hostPageId) {
      host.noteSource(view.id, {
        title: view.title,
        placements: view.placements,
      });
    }
  }, [view, host]);

  // Claim one of the page's live slots while this placement can go live;
  // the allocator is a store, so the outcome arrives as a re-render.
  const wantsLive = Boolean(
    host.collab && view && !view.tombstone && !view.sourceDeleted,
  );
  useEffect(() => {
    if (!wantsLive) return;
    host.claimLiveSlot(syncedBlockId);
    return () => host.releaseLiveSlot(syncedBlockId);
    // The allocator is stable for the page editor's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsLive, syncedBlockId]);
  const live = useSyncExternalStore(
    host.subscribe,
    () => wantsLive && host.isLive(syncedBlockId),
    () => false,
  );

  if (view === undefined) {
    return <Placeholder>Loading synced content…</Placeholder>;
  }
  if (view === null) {
    return (
      <Placeholder actions={<RemoveAction onDetach={onDetach} />}>
        Synced content you don&apos;t have access to
      </Placeholder>
    );
  }
  if (view.tombstone) {
    const when = view.deletedAt
      ? new Date(view.deletedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
    return (
      <Placeholder actions={<RemoveAction onDetach={onDetach} />}>
        Synced content that was deleted
        {view.title ? ` (“${view.title}”)` : ""}
        {when ? ` on ${when}` : ""}.
      </Placeholder>
    );
  }
  if (view.sourceDeleted) {
    return (
      <Placeholder
        actions={
          <>
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Check again
            </button>
            <RemoveAction onDetach={onDetach} />
          </>
        }
      >
        Synced content whose source page is in the trash. It returns when the
        page is restored.
      </Placeholder>
    );
  }

  const isSource = view.sourcePageId === host.hostPageId;
  const editable = host.editable && view.canEdit && !readOnly;
  const suggesting =
    host.editable &&
    !editable &&
    view.canSuggest &&
    !readOnly &&
    Boolean(host.actor);
  const cannotEditBecause = !host.editable
    ? null
    : readOnly
      ? "Read-only placement"
      : suggesting
        ? "Authored content: your edits here are suggestions"
        : !view.canEdit
          ? view.sourceAuthored
            ? "Authored content: only its author edits it"
            : "You can't edit the source page"
          : null;
  const sourceHref = view.sourcePageId
    ? `/w/${workspaceId}/p/${view.sourcePageId}`
    : null;

  return (
    <div
      className={cn(
        "group/synced relative -mx-2 rounded-md border border-transparent px-2 py-1 transition-colors",
        "hover:border-ring/60 focus-within:border-ring/60",
      )}
      // Keep the outer editor's key handling out of the nested one.
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      onCopy={(e) => e.stopPropagation()}
      onCut={(e) => e.stopPropagation()}
    >
      <div
        contentEditable={false}
        className="pointer-events-none absolute -top-3 left-2 z-10 hidden items-center gap-2 rounded bg-background px-1.5 text-xs text-muted-foreground group-hover/synced:flex group-focus-within/synced:flex"
      >
        <Repeat2 className="size-3" aria-hidden />
        {isSource ? (
          <span>
            Synced · appears in {view.placements} page
            {view.placements === 1 ? "" : "s"}
          </span>
        ) : sourceHref ? (
          <Link
            href={sourceHref}
            className="pointer-events-auto inline-flex items-center gap-1 hover:text-foreground"
          >
            {view.sourceIcon ? `${view.sourceIcon} ` : ""}
            {view.sourceTitle || "Untitled"}
            <ExternalLink className="size-3" aria-hidden />
          </Link>
        ) : null}
        {!isSource && (
          <span>
            · {view.placements} page{view.placements === 1 ? "" : "s"}
          </span>
        )}
        {cannotEditBecause && (
          <span
            className="inline-flex items-center gap-1"
            title={cannotEditBecause}
          >
            <Lock className="size-3" aria-hidden /> {cannotEditBecause}
          </span>
        )}
        {!live && host.collab && (
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-1 hover:text-foreground"
            title="This page hosts more synced blocks than can stay live at once; refresh to see the latest."
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <RefreshCw className="size-3" aria-hidden /> Snapshot
          </button>
        )}
        <button
          type="button"
          className="pointer-events-auto inline-flex items-center gap-1 hover:text-foreground"
          title="Copy as synced block — paste in any page to place it there"
          onClick={() => {
            void navigator.clipboard
              .writeText(syncedClipboardText(view.id))
              .then(() =>
                toast({
                  title: "Copied",
                  description: "Paste in any page to place this synced block.",
                }),
              );
          }}
        >
          <Copy className="size-3" aria-hidden /> Copy
        </button>
        {onToggleReadOnly && !isSource && (
          <button
            type="button"
            className="pointer-events-auto hover:text-foreground"
            onClick={onToggleReadOnly}
          >
            {readOnly ? "Make editable here" : "Make read-only here"}
          </button>
        )}
        {onDetach && !isSource && (
          <button
            type="button"
            className="pointer-events-auto hover:text-foreground"
            title="Remove this placement only; the content stays on its source page"
            onClick={onDetach}
          >
            Remove here
          </button>
        )}
      </div>

      {live && host.collab ? (
        <LiveContent
          key={view.id}
          view={view}
          hostPageId={host.hostPageId}
          editable={editable}
          suggesting={suggesting}
          collab={host.collab}
        />
      ) : (
        <div contentEditable={false} className="space-y-1">
          <Blocks
            blocks={view.blocks}
            ctx={{
              pageHref: (id) => `/w/${workspaceId}/p/${id}`,
              pageTitle: () => null,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The block spec.                                                     */
/* ------------------------------------------------------------------ */

/**
 * A placement of a synced block (Appendix A, Part 1). Holds only the
 * reference; content lives in the synced block's own document and is
 * rendered live when collaboration is on and a live slot is available.
 */
export const createSyncedBlockSpec = createReactBlockSpec(
  {
    type: "syncedBlock",
    propSchema: {
      syncedBlockId: { default: "" },
      readOnly: { default: false },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { syncedBlockId, readOnly } = block.props as {
        syncedBlockId: string;
        readOnly: boolean;
      };
      if (!syncedBlockId) {
        return (
          <SyncedPicker
            onSelect={(item) =>
              editor.updateBlock(block, {
                props: { syncedBlockId: item.id, readOnly: false },
              })
            }
          />
        );
      }
      return (
        <SyncedPlacementMemo
          syncedBlockId={syncedBlockId}
          readOnly={readOnly}
          onToggleReadOnly={
            editor.isEditable
              ? () =>
                  editor.updateBlock(block, {
                    props: { readOnly: !readOnly },
                  })
              : null
          }
          onDetach={
            editor.isEditable ? () => editor.removeBlocks([block]) : null
          }
        />
      );
    },
  },
);

// The placement re-renders on every outer editor change; memoising on the
// props keeps the nested editor mounted and its room connected.
function SyncedPlacementMemo(props: {
  syncedBlockId: string;
  readOnly: boolean;
  onToggleReadOnly: (() => void) | null;
  onDetach: (() => void) | null;
}) {
  const memo = useMemo(
    () => (
      <SyncedPlacement
        syncedBlockId={props.syncedBlockId}
        readOnly={props.readOnly}
        onToggleReadOnly={props.onToggleReadOnly}
        onDetach={props.onDetach}
      />
    ),
    // Handlers are recreated per render but do the same thing; identity
    // is deliberately excluded so the nested editor is not remounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.syncedBlockId, props.readOnly],
  );
  return memo;
}
