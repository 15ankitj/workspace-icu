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
import type { EditorBlock } from "@/lib/blocks";
import { editorSchema } from "@/components/editor/schema";
import { customSlashMenuItems } from "@/components/editor/slash-items";
import {
  PageLinkContext,
  type LinkablePage,
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
  initialContent,
  editable,
  smallText,
}: {
  pageId: string;
  workspaceId: string;
  linkablePages: LinkablePage[];
  initialContent: EditorBlock[];
  editable: boolean;
  smallText: boolean;
}) {
  const editor = useCreateBlockNote(
    {
      schema: editorSchema,
      initialContent: initialContent.length
        ? (initialContent as unknown as (typeof editorSchema)["PartialBlock"][])
        : undefined,
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
    () => ({ workspaceId, pages: linkablePages }),
    [workspaceId, linkablePages],
  );

  return (
    <PageLinkContext.Provider value={pageLinkValue}>
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
        </BlockNoteView>
      </div>
    </PageLinkContext.Provider>
  );
}
