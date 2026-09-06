import { Liveblocks } from "@liveblocks/node";

/**
 * Server-side Liveblocks administration (the secret never leaves the
 * platform environment). Used when content is removed for good: the
 * database row is the record, but the collaborative room would otherwise
 * keep a copy of the document upstream.
 */

/** Delete a room; true when it is gone (or was never there). */
export async function deleteLiveblocksRoom(roomId: string): Promise<boolean> {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return true;
  const liveblocks = new Liveblocks({ secret });
  try {
    await liveblocks.deleteRoom(roomId);
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return true;
    console.error(`Failed to delete Liveblocks room ${roomId}:`, error);
    return false;
  }
}
