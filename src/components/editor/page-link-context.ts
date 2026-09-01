"use client";

import { createContext, useContext } from "react";

export interface LinkablePage {
  id: string;
  title: string;
  icon: string | null;
}

export interface MentionableUser {
  id: string;
  displayName: string;
}

export interface EditorContextValue {
  workspaceId: string;
  pages: LinkablePage[];
  members: MentionableUser[];
}

/**
 * Supplies the page-link block and the mention inline content with the
 * workspace's pages and members.
 */
export const PageLinkContext = createContext<EditorContextValue>({
  workspaceId: "",
  pages: [],
  members: [],
});

export function usePageLinkContext() {
  return useContext(PageLinkContext);
}
