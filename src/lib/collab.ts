/**
 * Collaboration helpers shared by the auth route and the editor (brief §8).
 * Pure so they can be unit-tested.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Room names are `page:{page_id}`. */
export function roomIdForPage(pageId: string): string {
  return `page:${pageId}`;
}

/** Inverse of roomIdForPage; null for anything that is not a page room. */
export function pageIdFromRoomId(roomId: string): string | null {
  if (!roomId.startsWith("page:")) return null;
  const pageId = roomId.slice("page:".length);
  return UUID_PATTERN.test(pageId) ? pageId.toLowerCase() : null;
}

const CURSOR_COLOURS = [
  "#e11d48",
  "#d97706",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0d9488",
];

/** Base64 for Yjs binary state, chunked so large documents don't blow the
 * call stack. Works in browsers and Node (both expose btoa/atob). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Stable presence colour for a user, derived from their id. */
export function cursorColourFor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CURSOR_COLOURS[hash % CURSOR_COLOURS.length];
}
