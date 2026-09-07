"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { filterSuggestionItems } from "@blocknote/core";
import { CollaborationExtension } from "@blocknote/core/yjs";
import {
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { savePageContent } from "@/app/actions/blocks";
import { savePageDocument } from "@/app/actions/collab";
import { useFileUpload } from "@/components/page/file-upload";
import { useSaveStatus } from "@/components/page/save-status";
import type { EditorBlock } from "@/lib/blocks";
import { bytesToBase64, roomIdForPage } from "@/lib/collab";
import {
  locallyRemovedPlacementIds,
  parseSyncedClipboardText,
  syncedBlockIdsIn,
  type PlacementChange,
} from "@/lib/synced";
import { editorSchema } from "@/components/editor/schema";
import { customSlashMenuItems } from "@/components/editor/slash-items";
import { mentionMenuItems } from "@/components/editor/mention-items";
import { SyncedDragHandleMenu } from "@/components/editor/synced-drag-menu";
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
import {
  SuggestionPopover,
  SuggestionsBar,
  type SuggestionActor,
} from "@/components/editor/suggestions-ui";
import { registerSuggestions } from "@/app/actions/suggestions";
import { usePageMode } from "@/components/page/page-mode";
import { excerptOf, isOwnSuggestion } from "@/lib/suggestions";
import {
  SourceRemovalDialog,
  type SourceRemovalTarget,
} from "@/components/editor/synced-source-dialog";
import {
  SyncedHostContext,
  createLiveSlotAllocator,
  type SyncedHostValue,
  type SyncedSourceInfo,
} from "@/components/editor/synced-host-context";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import {
  acquireRoom,
  releaseRoom,
  type CollabRoom,
} from "@/components/editor/collab-room";
import {
  PageLinkContext,
  type LinkablePage,
  type MentionableUser,
} from "@/components/editor/page-link-context";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 1500;
/** A rejected save on an authored page is retried quietly: the author's
 *  own client persists their edits within this window. */
const AUTHORED_RETRY_MS = 4000;
/** New suggestions are indexed once typing pauses. */
const REGISTER_DEBOUNCE_MS = 2000;
/** A cut placement may be about to be pasted back; wait before asking. */
const REMOVAL_GRACE_MS = 1200;

/** A synced block whose source is this page but which no longer has a
 *  placement here (its source placement was removed without a decision). */
export interface DetachedSource {
  id: string;
  title: string;
  /** Pages still hosting a placement. */
  placements: number;
}

export interface CollabConfig {
  userName: string;
  userColour: string;
  /** Durable Yjs state from page_documents, if the page has been saved
   *  collaboratively before. */
  storedStateBase64: string | null;
}

/**
 * The page body editor. With collaboration configured (brief §8) it binds
 * BlockNote to a Yjs document synced through Liveblocks, with presence
 * cursors, and persists the encoded state to Supabase; otherwise it runs
 * in the Phase 2 local-only mode. Either way the whole document is saved
 * debounced through a server action under RLS, and the outcome is reported
 * to the page's save-status indicator. Synced block placements on the
 * page (Appendix A) mount their own live documents inside it.
 */
export function PageEditor({
  pageId,
  workspaceId,
  linkablePages,
  members,
  initialContent,
  editable,
  isPrivate,
  smallText,
  initialUploadCount,
  collab,
  detachedSources,
  actor: actorProp,
}: {
  pageId: string;
  workspaceId: string;
  linkablePages: LinkablePage[];
  members: MentionableUser[];
  initialContent: EditorBlock[];
  editable: boolean;
  isPrivate?: boolean;
  smallText: boolean;
  initialUploadCount: number;
  collab: CollabConfig | null;
  detachedSources?: DetachedSource[];
  /** Who is editing, for suggestion mode (Appendix A, Part 2); read-only
   *  previews (share links, gallery) omit it. */
  actor?: SuggestionActor;
}) {
  const actor = useMemo<SuggestionActor>(
    () =>
      actorProp ?? { userId: "", isAuthor: false, isOwner: false, members: [] },
    [actorProp],
  );
  const { uploadFile, dialogs } = useFileUpload({
    pageId,
    initialUploadCount,
  });
  const { report } = useSaveStatus();
  const roomId = roomIdForPage(pageId);
  const { mode, setPending } = usePageMode();
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [spans, setSpans] = useState<SuggestionSpan[]>([]);
  const [active, setActive] = useState<{
    span: SuggestionSpan;
    position: { left: number; top: number };
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const knownSuggestions = useRef<Set<string> | null>(null);
  const registerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Source placements on this page (Appendix A §1.3 rule 6): removing one
  // is not like removing any other block, so the editor asks what should
  // happen to the synced block. Placements register themselves as they
  // load; the map is never pruned, because unmounting is the removal.
  const sourcesRef = useRef(new Map<string, SyncedSourceInfo>());
  const removalCheck = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [removal, setRemoval] = useState<SourceRemovalTarget | null>(null);
  const [detached, setDetached] = useState<DetachedSource[]>(
    detachedSources ?? [],
  );

  // The room is acquired synchronously so the collaboration extension can
  // bind at editor creation; the ref-counted manager handles lifetimes.
  const [room] = useState<CollabRoom | null>(() =>
    collab ? acquireRoom(roomId, collab.storedStateBase64) : null,
  );
  useEffect(() => {
    if (!collab) return;
    acquireRoom(roomId, collab.storedStateBase64);
    return () => {
      releaseRoom(roomId);
      releaseRoom(roomId);
    };
    // The room is bound for this component instance's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useCreateBlockNote(
    {
      schema: editorSchema,
      extensions:
        room && collab
          ? [
              SuggestionsExtension(),
              CollaborationExtension({
                fragment: room.fragment,
                user: { name: collab.userName, color: collab.userColour },
                // Liveblocks bundles its own y-protocols; the awareness
                // object is protocol-compatible, only the nominal type
                // differs.
                provider: {
                  awareness: room.provider.awareness as unknown as Awareness,
                },
                showCursorLabels: "activity",
              }),
            ]
          : [SuggestionsExtension()],
      initialContent:
        !room && initialContent.length
          ? (initialContent as unknown as (typeof editorSchema)["PartialBlock"][])
          : undefined,
      uploadFile,
      // A pasted synced-block token places that block here (Appendix A
      // §1.3 rule 1); everything else pastes as usual.
      pasteHandler: ({ event, editor: pasteEditor, defaultPasteHandler }) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const syncedId = parseSyncedClipboardText(text);
        if (!syncedId) return defaultPasteHandler();
        const cursor = pasteEditor.getTextCursorPosition();
        pasteEditor.insertBlocks(
          [
            {
              type: "syncedBlock",
              props: { syncedBlockId: syncedId, readOnly: false },
            },
          ],
          cursor.block,
          "after",
        );
        return true;
      },
    },
    [pageId],
  );

  // Seed a room that is empty after its first sync (a page written before
  // collaboration existed) from the Phase 2 block rows, once.
  const seeded = useRef(false);
  useEffect(() => {
    if (!room || !editable || seeded.current) return;
    let cancelled = false;
    void room.synced.then(() => {
      if (cancelled || seeded.current) return;
      seeded.current = true;
      if (room.fragment.length === 0 && initialContent.length > 0) {
        editor.replaceBlocks(
          editor.document,
          initialContent as unknown as (typeof editorSchema)["PartialBlock"][],
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [room, editor, editable, initialContent]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!editable) return;

    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      // The clean projection: open suggestions reverted (brief §2.4).
      const blocks = cleanDocument(editor);
      const save = room
        ? savePageDocument(
            pageId,
            bytesToBase64(Y.encodeStateAsUpdate(room.doc)),
            blocks,
          )
        : savePageContent(pageId, blocks);
      report("saving");
      save
        .then(() => {
          if (!dirty.current) report("saved");
        })
        .catch((error) => {
          dirty.current = true;
          // On an authored page a non-author's save may carry the author's
          // not-yet-persisted edits; the author's client lands them within
          // seconds, so retry quietly rather than alarm the suggester.
          if (
            modeRef.current !== "edit" &&
            error instanceof Error &&
            error.message.includes("authored_content")
          ) {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(flush, AUTHORED_RETRY_MS);
            return;
          }
          console.error("Failed to save page:", error);
          // Keep the document marked dirty so a retry (or the next edit)
          // sends everything again.
          report("error", flush);
        });
    };

    // Suggestions present in the document (mine or anyone's): feed the
    // review bar and the header badge, and index the ones this user just
    // made (brief §2.3) once typing pauses.
    const trackSuggestions = () => {
      const current = listSuggestions(editor.prosemirrorState.doc);
      setSpans(current);
      setPending(current.length);
      if (!knownSuggestions.current) {
        knownSuggestions.current = new Set(current.map((s) => s.id));
        return;
      }
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
          .map((s) => ({
            id: s.id,
            kind: s.kind,
            excerpt: excerptOf(s.text),
          }));
        for (const item of items) knownSuggestions.current!.add(item.id);
        if (items.length > 0) {
          registerSuggestions(pageId, items).catch((error) =>
            console.error("Failed to record suggestions:", error),
          );
        }
      }, REGISTER_DEBOUNCE_MS);
    };
    trackSuggestions();

    const unsubscribe = editor.onChange((_, { getChanges }) => {
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
      trackSuggestions();

      // Did this user just remove a source placement? Ask once it is clear
      // the block is not coming straight back (cut and paste, undo).
      const removed = locallyRemovedPlacementIds(
        getChanges() as unknown as PlacementChange[],
      ).filter((id) => sourcesRef.current.has(id));
      if (removed.length === 0) return;
      if (removalCheck.current) clearTimeout(removalCheck.current);
      removalCheck.current = setTimeout(() => {
        const present = new Set(
          syncedBlockIdsIn(editor.document as unknown as EditorBlock[]),
        );
        const gone = removed.find((id) => !present.has(id));
        const info = gone ? sourcesRef.current.get(gone) : undefined;
        if (!gone || !info) return;
        setRemoval({
          id: gone,
          title: info.title,
          otherPages: Math.max(0, info.placements - 1),
        });
      }, REMOVAL_GRACE_MS);
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (removalCheck.current) clearTimeout(removalCheck.current);
      if (registerTimer.current) clearTimeout(registerTimer.current);
      flush();
    };
  }, [editor, pageId, room, editable, report, setPending, actor.userId]);

  // Suggest mode: route this user's transactions through the suggestion
  // transform while it is on; the view is mounted by the time effects run.
  useEffect(() => {
    if (!editable) return;
    let uninstall: (() => void) | null = null;
    try {
      uninstall = installSuggestDispatch(editor, actor.userId);
    } catch (error) {
      console.error("Suggest mode unavailable:", error);
    }
    return () => uninstall?.();
  }, [editor, editable, actor.userId]);

  useEffect(() => {
    if (!editable) return;
    try {
      setSuggesting(editor, mode === "suggest");
    } catch {
      // Not mounted yet; the next mode change or mount re-applies it.
    }
  }, [editor, editable, mode]);

  // The suggestion under the caret gets a floating Accept / Reject /
  // Withdraw; positions are relative to the editor container.
  useEffect(() => {
    const unsubscribe = editor.onSelectionChange(() => {
      const span = suggestionAtSelection(editor, spans);
      const container = containerRef.current;
      if (!span || !container) {
        setActive(null);
        return;
      }
      const coords = coordsOf(editor, span.from);
      if (!coords) {
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
  }, [editor, spans]);

  /** Re-insert a placement at the end of the page ("Put it back"). */
  const putBack = (id: string) => {
    const last = editor.document[editor.document.length - 1];
    editor.insertBlocks(
      [{ type: "syncedBlock", props: { syncedBlockId: id, readOnly: false } }],
      last,
      "after",
    );
    setDetached((list) => list.filter((item) => item.id !== id));
  };

  const pageLinkValue = useMemo(
    () => ({ workspaceId, pages: linkablePages, members }),
    [workspaceId, linkablePages, members],
  );

  // One live-slot allocator per page editor (Appendix A §1.4).
  const [allocator] = useState(() => createLiveSlotAllocator());
  const syncedHost = useMemo<SyncedHostValue>(
    () => ({
      hostPageId: pageId,
      workspaceId,
      editable,
      hostIsPrivate: Boolean(isPrivate),
      collab: collab
        ? { userName: collab.userName, userColour: collab.userColour }
        : null,
      claimLiveSlot: allocator.claim,
      releaseLiveSlot: allocator.release,
      subscribe: allocator.subscribe,
      isLive: allocator.isLive,
      noteSource: (id, info) => {
        sourcesRef.current.set(id, info);
      },
    }),
    [pageId, workspaceId, editable, isPrivate, collab, allocator],
  );

  return (
    <PageLinkContext.Provider value={pageLinkValue}>
      <SyncedHostContext.Provider value={syncedHost}>
        {dialogs}
        {editable && detached.length > 0 && (
          <Notice
            variant="warning"
            title={
              detached.length === 1
                ? "A synced block was removed from this page but still appears elsewhere"
                : `${detached.length} synced blocks were removed from this page but still appear elsewhere`
            }
          >
            <p>
              This page is their source. Put each back, delete it everywhere, or
              make one of the other pages the source.
            </p>
            <ul className="space-y-1">
              {detached.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    {item.title || "Synced block"}
                    <span className="text-muted-foreground">
                      {" "}
                      · appears in {item.placements} page
                      {item.placements === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRemoval({
                        id: item.id,
                        title: item.title,
                        otherPages: item.placements,
                      })
                    }
                  >
                    Resolve…
                  </Button>
                </li>
              ))}
            </ul>
          </Notice>
        )}
        <SourceRemovalDialog
          target={removal}
          onPutBack={removal ? () => putBack(removal.id) : null}
          onResolved={(id) => {
            sourcesRef.current.delete(id);
            setDetached((list) => list.filter((item) => item.id !== id));
            setRemoval(null);
          }}
          onClose={() => setRemoval(null)}
        />
        {/* BlockNote's side gutter is removed in globals.css so body text
            shares a left edge with the title above it. */}
        {editable && (
          <SuggestionsBar
            editor={editor}
            pageId={pageId}
            actor={actor}
            spans={spans}
          />
        )}
        <div
          ref={containerRef}
          className={cn("relative", smallText && "text-sm")}
        >
          {active && editable && (
            <SuggestionPopover
              key={active.span.id}
              editor={editor}
              pageId={pageId}
              actor={actor}
              span={active.span}
              position={active.position}
            />
          )}
          <BlockNoteView
            editor={editor}
            editable={editable && mode !== "view"}
            slashMenu={false}
            sideMenu={false}
          >
            <SideMenuController
              sideMenu={(props) => (
                <SideMenu {...props} dragHandleMenu={SyncedDragHandleMenu} />
              )}
            />
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                filterSuggestionItems(
                  [
                    ...getDefaultReactSlashMenuItems(editor),
                    ...customSlashMenuItems(editor),
                  ],
                  query,
                )
              }
            />
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={async (query) =>
                filterSuggestionItems(
                  mentionMenuItems(editor, members, linkablePages),
                  query,
                )
              }
            />
          </BlockNoteView>
        </div>
      </SyncedHostContext.Provider>
    </PageLinkContext.Provider>
  );
}
