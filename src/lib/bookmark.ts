/**
 * Bookmark block helpers: URL validation for the server-side metadata
 * fetch, and HTML metadata extraction. Kept pure for unit testing.
 */

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[/, // IPv6 literals
];

/**
 * Only public https URLs are fetched server-side; hostname-based checks
 * are a first line against SSRF, not a substitute for network policy.
 */
export function isFetchableUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname;
  if (!host.includes(".")) return false;
  if (BLOCKED_HOST_PATTERNS.some((p) => p.test(host))) return false;
  // Reject raw IPv4 addresses outright.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  return true;
}

export interface BookmarkMetadata {
  title: string | null;
  description: string | null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function findMetaContent(html: string, name: string): string | null {
  // Matches <meta property="og:x" content="..."> with either attribute order.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

export function parseBookmarkMetadata(html: string): BookmarkMetadata {
  const head = html.slice(0, 200_000);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title =
    findMetaContent(head, "og:title") ??
    (titleTag?.[1] ? decodeEntities(titleTag[1]) : null);
  const description =
    findMetaContent(head, "og:description") ??
    findMetaContent(head, "description");
  return {
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 500) : null,
  };
}
