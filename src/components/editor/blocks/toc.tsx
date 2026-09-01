"use client";

import { useEffect, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import { cn } from "@/lib/utils";

interface HeadingEntry {
  id: string;
  text: string;
  level: number;
}

function collectHeadings(
  editor: BlockNoteEditor<never, never, never>,
): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const walk = (
    blocks: {
      id: string;
      type: string;
      props?: unknown;
      content?: unknown;
      children?: unknown;
    }[],
  ) => {
    for (const block of blocks) {
      if (block.type === "heading") {
        const content = Array.isArray(block.content) ? block.content : [];
        const text = content
          .map((c: { text?: string }) => c.text ?? "")
          .join("")
          .trim();
        const level =
          typeof (block.props as { level?: number })?.level === "number"
            ? (block.props as { level: number }).level
            : 1;
        if (text) headings.push({ id: block.id, text, level });
      }
      if (Array.isArray(block.children) && block.children.length) {
        walk(block.children as typeof blocks);
      }
    }
  };
  walk(editor.document as unknown as Parameters<typeof walk>[0]);
  return headings;
}

function TableOfContents({
  editor,
}: {
  editor: BlockNoteEditor<never, never, never>;
}) {
  const [headings, setHeadings] = useState<HeadingEntry[]>(() =>
    collectHeadings(editor),
  );

  useEffect(() => {
    const unsubscribe = editor.onChange(() =>
      setHeadings(collectHeadings(editor)),
    );
    return () => unsubscribe?.();
  }, [editor]);

  const jumpTo = (id: string) => {
    document
      .querySelector(`[data-id="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      contentEditable={false}
      aria-label="Table of contents"
      className="w-full rounded-md border p-3 text-sm"
    >
      {headings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Headings on this page will appear here.
        </p>
      ) : (
        <ul className="space-y-1">
          {headings.map((h) => (
            <li
              key={h.id}
              className={cn(h.level === 2 && "pl-4", h.level >= 3 && "pl-8")}
            >
              <button
                type="button"
                className="text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => jumpTo(h.id)}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

/** Auto-generated table of contents from the page's headings. */
export const createTocSpec = createReactBlockSpec(
  {
    type: "tableOfContents",
    propSchema: {},
    content: "none",
  },
  {
    render: ({ editor }) => (
      <TableOfContents
        editor={editor as BlockNoteEditor<never, never, never>}
      />
    ),
  },
);
