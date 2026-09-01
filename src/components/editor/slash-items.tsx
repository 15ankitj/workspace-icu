"use client";

import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import {
  Bookmark,
  Lightbulb,
  Link2,
  ListTree,
  MonitorPlay,
} from "lucide-react";
import type { EditorSchema } from "@/components/editor/schema";

type Editor = EditorSchema["BlockNoteEditor"];

/** Slash-menu entries for the custom v1 blocks. */
export function customSlashMenuItems(
  editor: Editor,
): DefaultReactSuggestionItem[] {
  return [
    {
      title: "Callout",
      subtext: "Highlight something with an icon",
      aliases: ["callout", "info", "note"],
      group: "Basic blocks",
      icon: <Lightbulb className="size-4" />,
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "callout" }),
    },
    {
      title: "Link to page",
      subtext: "Reference another page",
      aliases: ["page", "pagelink", "link to page"],
      group: "Basic blocks",
      icon: <Link2 className="size-4" />,
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "pageLink" }),
    },
    {
      title: "Bookmark",
      subtext: "Link card with title and description",
      aliases: ["bookmark", "link", "url"],
      group: "Media",
      icon: <Bookmark className="size-4" />,
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "bookmark" }),
    },
    {
      title: "Embed",
      subtext: "YouTube, Google Drive or PDF",
      aliases: ["embed", "youtube", "drive", "pdf", "iframe"],
      group: "Media",
      icon: <MonitorPlay className="size-4" />,
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "embed" }),
    },
    {
      title: "Table of contents",
      subtext: "Generated from this page's headings",
      aliases: ["toc", "contents", "outline"],
      group: "Advanced",
      icon: <ListTree className="size-4" />,
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "tableOfContents" }),
    },
  ];
}
