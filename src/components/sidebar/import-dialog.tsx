"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { useCreateBlockNote } from "@blocknote/react";
import { editorSchema } from "@/components/editor/schema";
import { useFileUpload } from "@/components/page/file-upload";
import { createEmptyPage } from "@/app/actions/import";
import { savePageContent } from "@/app/actions/blocks";
import { countMyUploads } from "@/app/actions/files";
import type { EditorBlock } from "@/lib/blocks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";

/**
 * Import Markdown and .docx files as pages (brief §5). Parsing happens in
 * the browser with the editor's own parsers (and mammoth for .docx);
 * embedded images go through the normal upload gate and PHI scan.
 */
export function ImportDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileId = useId();
  // Headless editor used only for parsing.
  const editor = useCreateBlockNote({ schema: editorSchema });
  const [uploadCount, setUploadCount] = useState(0);
  const { uploadTo, dialogs } = useFileUpload({
    pageId: "",
    initialUploadCount: uploadCount,
  });

  async function parseFile(
    file: File,
  ): Promise<{ title: string; blocks: EditorBlock[] }> {
    const baseTitle = file.name.replace(/\.(md|markdown|txt|docx)$/i, "");
    let blocks: EditorBlock[];
    if (/\.docx$/i.test(file.name)) {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        {
          convertImage: mammoth.images.imgElement((image) =>
            image.read("base64").then((data) => ({
              src: `data:${image.contentType};base64,${data}`,
            })),
          ),
        },
      );
      blocks = editor.tryParseHTMLToBlocks(
        result.value,
      ) as unknown as EditorBlock[];
    } else {
      blocks = editor.tryParseMarkdownToBlocks(
        await file.text(),
      ) as unknown as EditorBlock[];
    }
    // A leading H1 becomes the page title.
    const first = blocks[0];
    let title = baseTitle;
    if (
      first?.type === "heading" &&
      (first.props as { level?: number } | undefined)?.level === 1 &&
      Array.isArray(first.content)
    ) {
      const text = first.content
        .map((c) => (c as { text?: string }).text ?? "")
        .join("")
        .trim();
      if (text) {
        title = text;
        blocks = blocks.slice(1);
      }
    }
    return { title, blocks };
  }

  async function uploadEmbeddedImages(pageId: string, blocks: EditorBlock[]) {
    let counter = 0;
    const walk = async (list: EditorBlock[]) => {
      for (const block of list) {
        const url = (block.props as { url?: unknown } | undefined)?.url;
        if (
          block.type === "image" &&
          typeof url === "string" &&
          url.startsWith("data:")
        ) {
          const blob = await (await fetch(url)).blob();
          const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
          const file = new File([blob], `image-${++counter}.${ext}`, {
            type: blob.type,
          });
          try {
            const uploaded = await uploadTo(pageId, file);
            block.props = { ...block.props, url: uploaded };
          } catch (error) {
            // Cancelled or rejected: drop the image rather than embed data.
            console.error("Embedded image not imported:", error);
            block.props = { ...block.props, url: "" };
          }
        }
        if (block.children?.length) await walk(block.children);
      }
    };
    await walk(blocks);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={async () => {
          setProgress(null);
          setError(null);
          setOpen(true);
          setUploadCount(await countMyUploads().catch(() => 0));
        }}
      >
        <Upload /> Import
      </Button>
      {dialogs}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Import pages</DialogTitle>
          <DialogDescription>
            Markdown (.md) and Word (.docx) files become new top-level pages —
            text, headings, lists, tables and images, best effort.
          </DialogDescription>
          <Notice variant="warning">
            Check each document first: no patient-identifiable information.
          </Notice>
          <Field
            label="Files to import"
            htmlFor={fileId}
            hint="You can choose several at once."
          >
            <input
              id={fileId}
              type="file"
              multiple
              accept=".md,.markdown,.txt,.docx"
              disabled={isPending}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80 disabled:opacity-50"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length === 0) return;
                setError(null);
                startTransition(async () => {
                  let lastPageId: string | null = null;
                  let done = 0;
                  for (const file of files) {
                    try {
                      setProgress(
                        `Importing ${file.name} (${done + 1} of ${files.length})…`,
                      );
                      const { title, blocks } = await parseFile(file);
                      const { pageId } = await createEmptyPage(
                        workspaceId,
                        null,
                        title,
                      );
                      await uploadEmbeddedImages(pageId, blocks);
                      await savePageContent(pageId, blocks);
                      lastPageId = pageId;
                      done++;
                    } catch (error) {
                      setProgress(null);
                      setError(
                        `${file.name} could not be imported: ${
                          error instanceof Error
                            ? error.message
                            : "unknown error"
                        }${done ? `. ${done} page${done === 1 ? "" : "s"} imported before it.` : "."}`,
                      );
                      router.refresh();
                      return;
                    }
                  }
                  setProgress(null);
                  toast({
                    title: `Imported ${done} page${done === 1 ? "" : "s"}`,
                  });
                  router.refresh();
                  if (lastPageId) {
                    setOpen(false);
                    router.push(`/w/${workspaceId}/p/${lastPageId}`);
                  }
                });
              }}
            />
          </Field>
          {progress && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2
                className="size-4 motion-safe:animate-spin"
                aria-hidden
              />
              {progress}
            </p>
          )}
          {error && (
            <Notice variant="destructive" title="Import stopped">
              <p>{error}</p>
            </Notice>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
