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
import { parseSyncedClipboardText } from "@/lib/synced";
import { editorSchema } from "@/components/editor/schema";
import { customSlashMenuItems } from "@/components/editor/slash-items";
import { mentionMenuItems } from "@/components/editor/mention-items";
import { SyncedDragHandleMenu } from "@/components/editor/synced-drag-menu";
import {
  SyncedHostContext,
  createLiveSlotAllocator,
  type SyncedHostValue,
} from "@/components/editor/synced-host-context";
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
}) {
  const { uploadFile, dialogs } = useFileUpload({
    pageId,
    initialUploadCount,
  });
  const { report } = useSaveStatus();
  const roomId = roomIdForPage(pageId);

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
      ...(room && collab
        ? {
            extensions: [
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
            ],
          }
        : {
            initialContent: initialContent.length
              ? (initialContent as unknown as (typeof editorSchema)["PartialBlock"][])
              : undefined,
          }),
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
      const blocks = editor.document as unknown as EditorBlock[];
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
          console.error("Failed to save page:", error);
          // Keep the document marked dirty so a retry (or the next edit)
          // sends everything again.
          dirty.current = true;
          report("error", flush);
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
  }, [editor, pageId, room, editable, report]);

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
    }),
    [pageId, workspaceId, editable, isPrivate, collab, allocator],
  );

  return (
    <PageLinkContext.Provider value={pageLinkValue}>
      <SyncedHostContext.Provider value={syncedHost}>
        {dialogs}
        {/* BlockNote's side gutter is removed in globals.css so body text
            shares a left edge with the title above it. */}
        <div className={cn(smallText && "text-sm")}>
          <BlockNoteView
            editor={editor}
            editable={editable}
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
