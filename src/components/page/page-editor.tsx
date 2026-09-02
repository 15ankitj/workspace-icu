"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { useEffect, useMemo, useRef } from "react";
import { filterSuggestionItems } from "@blocknote/core";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { savePageContent } from "@/app/actions/blocks";
import { useFileUpload } from "@/components/page/file-upload";
import type { EditorBlock } from "@/lib/blocks";
import { editorSchema } from "@/components/editor/schema";
import { customSlashMenuItems } from "@/components/editor/slash-items";
import { mentionMenuItems } from "@/components/editor/mention-items";
import {
  PageLinkContext,
  type LinkablePage,
  type MentionableUser,
} from "@/components/editor/page-link-context";

const SAVE_DEBOUNCE_MS = 1500;

/**
 * The page body editor. Local-only editing (Phase 2): saves the whole
 * document, debounced, via a server action; real-time collaboration
 * arrives in Phase 3 without changing this component's contract.
 */
export function PageEditor({
  pageId,
  workspaceId,
  linkablePages,
  members,
  initialContent,
  editable,
  smallText,
  initialUploadCount,
}: {
  pageId: string;
  workspaceId: string;
  linkablePages: LinkablePage[];
  members: MentionableUser[];
  initialContent: EditorBlock[];
  editable: boolean;
  smallText: boolean;
  initialUploadCount: number;
}) {
  const { uploadFile, dialogs } = useFileUpload({
    pageId,
    initialUploadCount,
  });

  const editor = useCreateBlockNote(
    {
      schema: editorSchema,
      initialContent: initialContent.length
        ? (initialContent as unknown as (typeof editorSchema)["PartialBlock"][])
        : undefined,
      uploadFile,
    },
    [pageId],
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      void savePageContent(
        pageId,
        editor.document as unknown as EditorBlock[],
      ).catch((error) => console.error("Failed to save page:", error));
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
  }, [editor, pageId]);

  const pageLinkValue = useMemo(
    () => ({ workspaceId, pages: linkablePages, members }),
    [workspaceId, linkablePages, members],
  );

  return (
    <PageLinkContext.Provider value={pageLinkValue}>
      {dialogs}
      <div className={smallText ? "-mx-[54px] text-sm" : "-mx-[54px]"}>
        <BlockNoteView editor={editor} editable={editable} slashMenu={false}>
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
    </PageLinkContext.Provider>
  );
}
