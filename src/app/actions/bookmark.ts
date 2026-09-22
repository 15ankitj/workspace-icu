"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isFetchableUrl,
  parseBookmarkMetadata,
  redirectTarget,
  type BookmarkMetadata,
} from "@/lib/bookmark";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 500_000;
const MAX_REDIRECTS = 3;

/** Fetch, following redirects only to URLs that pass the same check as
 *  the first one (a redirect to a private address is a classic SSRF). */
async function fetchPublic(url: string): Promise<Response | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    if (response.status < 300 || response.status >= 400) return response;
    const next = redirectTarget(current, response.headers.get("location"));
    await response.body?.cancel().catch(() => {});
    if (!next) return null;
    current = next;
  }
  return null;
}

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
    const response = await fetchPublic(url);
    if (!response) return { title: null, description: null };
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
