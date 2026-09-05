"use client";

import { createContext, useContext } from "react";
import { MAX_LIVE_SYNCED_SOURCES } from "@/lib/synced";

export interface SyncedHostCollab {
  userName: string;
  userColour: string;
}

export interface SyncedHostValue {
  /** The page the placement sits on (recorded in audit events). */
  hostPageId: string;
  workspaceId: string;
  /** Whether the host page itself is editable by this user. */
  editable: boolean;
  /** Private host pages warn the creator at creation time (rule 4). */
  hostIsPrivate: boolean;
  /** Null when collaboration is not configured: placements then render
   *  the stored projection read-only. */
  collab: SyncedHostCollab | null;
  /** Bounded fan-out (Appendix A §1.4): the first N distinct sources on a
   *  page go live; the rest render a snapshot with a refresh button. */
  claimLiveSlot: (syncedBlockId: string) => boolean;
  releaseLiveSlot: (syncedBlockId: string) => void;
  /** Store interface for useSyncExternalStore: notified on every claim
   *  or release, so placements re-render without setting state in effects. */
  subscribe: (listener: () => void) => () => void;
  isLive: (syncedBlockId: string) => boolean;
}

export const SyncedHostContext = createContext<SyncedHostValue>({
  hostPageId: "",
  workspaceId: "",
  editable: false,
  hostIsPrivate: false,
  collab: null,
  claimLiveSlot: () => false,
  releaseLiveSlot: () => {},
  subscribe: () => () => {},
  isLive: () => false,
});

export function useSyncedHost() {
  return useContext(SyncedHostContext);
}

/** A per-page allocator for live slots; one instance per page editor. */
export function createLiveSlotAllocator(max = MAX_LIVE_SYNCED_SOURCES) {
  const live = new Map<string, number>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    claim(id: string): boolean {
      const count = live.get(id);
      if (count !== undefined) {
        live.set(id, count + 1);
        return true;
      }
      if (live.size >= max) return false;
      live.set(id, 1);
      notify();
      return true;
    },
    release(id: string) {
      const count = live.get(id);
      if (count === undefined) return;
      if (count <= 1) {
        live.delete(id);
        notify();
      } else {
        live.set(id, count - 1);
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isLive(id: string) {
      return live.has(id);
    },
  };
}
