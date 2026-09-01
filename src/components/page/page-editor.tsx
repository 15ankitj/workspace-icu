"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { useEffect, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { PartialBlock } from "@blocknote/core";
import { savePageContent } from "@/app/actions/blocks";
import type { EditorBlock } from "@/lib/blocks";

const SAVE_DEBOUNCE_MS = 1500;

/**
 * The page body editor. Local-only editing (Phase 2): saves the whole
 * document, debounced, via a server action; real-time collaboration
 * arrives in Phase 3 without changing this component's contract.
 */
export function PageEditor({
  pageId,
  initialContent,
  editable,
}: {
  pageId: string;
  initialContent: EditorBlock[];
  editable: boolean;
}) {
  const editor = useCreateBlockNote(
    {
      initialContent: initialContent.length
        ? (initialContent as PartialBlock[])
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
      void savePageContent(pageId, editor.document as EditorBlock[]).catch(
        (error) => console.error("Failed to save page:", error),
      );
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

  return (
    <div className="-mx-[54px]">
      <BlockNoteView editor={editor} editable={editable} />
    </div>
  );
}
