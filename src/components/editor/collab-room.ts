"use client";

import * as Y from "yjs";
import { createClient, type Client } from "@liveblocks/client";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { base64ToBytes } from "@/lib/collab";

export interface CollabRoom {
  doc: Y.Doc;
  fragment: Y.XmlFragment;
  provider: LiveblocksYjsProvider;
  /** Resolves once the first sync with the server has completed. */
  synced: Promise<void>;
}

interface Entry {
  room: CollabRoom;
  leave: () => void;
  refs: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

let client: Client | null = null;
const rooms = new Map<string, Entry>();

function getClient(): Client {
  client ??= createClient({ authEndpoint: "/api/liveblocks-auth" });
  return client;
}

/**
 * Enter (or reuse) a Liveblocks room — `page:{id}` for a page's document,
 * `synced:{id}` for a synced block's. Ref-counted with a short release
 * grace period so React's development double-mount, or a quick
 * navigate-away-and-back, never tears down and rebuilds a live
 * connection. The stored Yjs state (if any) is applied before the
 * provider connects, so an empty or new room is seeded from the durable
 * copy.
 */
export function acquireRoom(
  roomId: string,
  storedStateBase64: string | null,
): CollabRoom {
  const existing = rooms.get(roomId);
  if (existing) {
    existing.refs += 1;
    if (existing.releaseTimer) {
      clearTimeout(existing.releaseTimer);
      existing.releaseTimer = null;
    }
    return existing.room;
  }

  const doc = new Y.Doc();
  if (storedStateBase64) {
    try {
      Y.applyUpdate(doc, base64ToBytes(storedStateBase64));
    } catch (error) {
      console.error("Stored document state could not be applied:", error);
    }
  }
  const fragment = doc.getXmlFragment("document");

  const { room: liveRoom, leave } = getClient().enterRoom(roomId);
  const provider = new LiveblocksYjsProvider(liveRoom, doc);
  const synced = new Promise<void>((resolve) => {
    if (provider.synced) return resolve();
    const handler = (isSynced: boolean) => {
      if (isSynced) {
        provider.off("sync", handler);
        resolve();
      }
    };
    provider.on("sync", handler);
  });

  const room: CollabRoom = { doc, fragment, provider, synced };
  rooms.set(roomId, { room, leave, refs: 1, releaseTimer: null });
  return room;
}

export function releaseRoom(roomId: string) {
  const entry = rooms.get(roomId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.releaseTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    rooms.delete(roomId);
    entry.room.provider.destroy();
    entry.leave();
    entry.room.doc.destroy();
  }, 250);
}
