"use client";

import { createContext, useContext } from "react";

export interface LinkablePage {
  id: string;
  title: string;
  icon: string | null;
}

export interface PageLinkContextValue {
  workspaceId: string;
  pages: LinkablePage[];
}

/** Supplies the page-link block with the workspace's pages. */
export const PageLinkContext = createContext<PageLinkContextValue>({
  workspaceId: "",
  pages: [],
});

export function usePageLinkContext() {
  return useContext(PageLinkContext);
}
