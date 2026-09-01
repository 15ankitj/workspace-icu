"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isFetchableUrl,
  parseBookmarkMetadata,
  type BookmarkMetadata,
} from "@/lib/bookmark";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 500_000;

/**
 * Best-effort title/description for a bookmark block. Signed-in users
 * only; public https URLs only (see isFetchableUrl). Failures return
 * empty metadata — the block then just shows the URL.
 */
export async function fetchBookmarkMetadata(
  url: string,
): Promise<BookmarkMetadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  if (!isFetchableUrl(url)) return { title: null, description: null };

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: { accept: "text/html" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return { title: null, description: null };
    }
    const reader = response.body?.getReader();
    if (!reader) return { title: null, description: null };
    let html = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    while (bytes < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => {});
    return parseBookmarkMetadata(html);
  } catch {
    return { title: null, description: null };
  }
}
