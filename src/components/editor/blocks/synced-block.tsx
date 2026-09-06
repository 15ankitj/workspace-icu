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

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      contentEditable={false}
      className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
    >
      <Repeat2 className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
      {children}
    </div>
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
  collab,
}: {
  view: SyncedBlockView;
  hostPageId: string;
  editable: boolean;
  collab: { userName: string; userColour: string };
}) {
  const roomId = roomIdForSyncedBlock(view.id);
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
    if (!editable || seeded.current) return;
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
  }, [room, editor, editable, view.blocks]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  useEffect(() => {
    if (!editable) return;
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      saveSyncedBlock(
        view.id,
        bytesToBase64(Y.encodeStateAsUpdate(room.doc)),
        editor.document as unknown as EditorBlock[],
        hostPageId,
      ).catch((error) => {
        console.error("Failed to save synced block:", error);
        dirty.current = true;
        toast({
          title: "Synced block not saved",
          description:
            "Your edit is still on screen. Retrying on the next change.",
          variant: "destructive",
        });
      });
    };
    const unsubscribe = editor.onChange(() => {
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush();
    };
  }, [editor, room, editable, view.id, hostPageId]);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      sideMenu={false}
      slashMenu={editable}
      formattingToolbar={editable}
    />
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
      <Placeholder>Synced content you don&apos;t have access to</Placeholder>
    );
  }
  if (view.tombstone) {
    return (
      <Placeholder>
        Synced content that was removed
        {view.title ? ` (“${view.title}”)` : ""}.
      </Placeholder>
    );
  }
  if (view.sourceDeleted) {
    return (
      <Placeholder>
        Synced content whose source page is in the trash. It returns when the
        page is restored.
      </Placeholder>
    );
  }

  const isSource = view.sourcePageId === host.hostPageId;
  const editable = host.editable && view.canEdit && !readOnly;
  const cannotEditBecause = !host.editable
    ? null
    : readOnly
      ? "Read-only placement"
      : !view.canEdit
        ? "You can't edit the source page"
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
