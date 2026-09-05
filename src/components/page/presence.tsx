"use client";

import { useEffect, useState } from "react";
import { AvatarStack } from "@/components/ui/avatar";
import { acquireRoom, releaseRoom } from "@/components/editor/collab-room";

interface Peer {
  id: string;
  name: string;
}

/**
 * Who else has this page open right now, from the collaboration room's
 * awareness states. Renders nothing when collaboration is off or nobody
 * else is here.
 */
export function PresenceAvatars({
  pageId,
  storedStateBase64,
  selfName,
}: {
  pageId: string;
  storedStateBase64: string | null;
  selfName: string;
}) {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const room = acquireRoom(pageId, storedStateBase64);
    const awareness = room.provider.awareness;
    const read = () => {
      const next: Peer[] = [];
      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === room.doc.clientID) continue;
        const user = (state as { user?: { name?: string } }).user;
        if (!user?.name) continue;
        next.push({ id: String(clientId), name: user.name });
      }
      setPeers(next);
    };
    awareness.on("change", read);
    read();
    return () => {
      awareness.off("change", read);
      releaseRoom(pageId);
    };
  }, [pageId, storedStateBase64]);

  if (peers.length === 0) return null;

  return (
    <span
      className="flex items-center"
      aria-label={`Also here: ${peers.map((p) => p.name).join(", ")}`}
      title={`Also here: ${peers.map((p) => p.name).join(", ")} (you are ${selfName})`}
    >
      <AvatarStack people={peers} size="md" />
    </span>
  );
}
