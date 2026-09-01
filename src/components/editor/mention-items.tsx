"use client";

import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { FileText, User } from "lucide-react";
import type { EditorSchema } from "@/components/editor/schema";
import type {
  LinkablePage,
  MentionableUser,
} from "@/components/editor/page-link-context";

type Editor = EditorSchema["BlockNoteEditor"];

/** "@" menu: mention a workspace member or reference a page inline. */
export function mentionMenuItems(
  editor: Editor,
  members: MentionableUser[],
  pages: LinkablePage[],
): DefaultReactSuggestionItem[] {
  const userItems = members.map<DefaultReactSuggestionItem>((member) => ({
    title: member.displayName,
    group: "People",
    icon: <User className="size-4" />,
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: "userMention",
          props: { userId: member.id, name: member.displayName },
        },
        " ",
      ]);
    },
  }));

  const pageItems = pages.map<DefaultReactSuggestionItem>((page) => ({
    title: page.title || "Untitled",
    group: "Pages",
    icon: page.icon ? (
      <span className="w-4 text-center">{page.icon}</span>
    ) : (
      <FileText className="size-4" />
    ),
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: "pageMention",
          props: {
            pageId: page.id,
            title: page.title,
            icon: page.icon ?? "",
          },
        },
        " ",
      ]);
    },
  }));

  return [...userItems, ...pageItems];
}
