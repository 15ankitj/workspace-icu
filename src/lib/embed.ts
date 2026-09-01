/**
 * Embed whitelist (brief §6): YouTube, Google Drive viewer, and PDFs only.
 * Anything else renders as a plain link, never an iframe.
 */

export type ResolvedEmbed = {
  src: string;
  kind: "youtube" | "drive" | "pdf";
};

export function resolveEmbedUrl(raw: string): ResolvedEmbed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();

  // YouTube: watch, share and shorts URLs → privacy-enhanced embed.
  if (
    host === "www.youtube.com" ||
    host === "youtube.com" ||
    host === "m.youtube.com"
  ) {
    let videoId: string | null = null;
    if (url.pathname === "/watch") videoId = url.searchParams.get("v");
    else if (url.pathname.startsWith("/shorts/"))
      videoId = url.pathname.split("/")[2] ?? null;
    else if (url.pathname.startsWith("/embed/"))
      videoId = url.pathname.split("/")[2] ?? null;
    if (videoId && /^[\w-]{5,20}$/.test(videoId)) {
      return {
        src: `https://www.youtube-nocookie.com/embed/${videoId}`,
        kind: "youtube",
      };
    }
    return null;
  }
  if (host === "youtu.be") {
    const videoId = url.pathname.slice(1).split("/")[0];
    if (/^[\w-]{5,20}$/.test(videoId)) {
      return {
        src: `https://www.youtube-nocookie.com/embed/${videoId}`,
        kind: "youtube",
      };
    }
    return null;
  }
  if (
    host === "www.youtube-nocookie.com" &&
    url.pathname.startsWith("/embed/")
  ) {
    return { src: url.toString(), kind: "youtube" };
  }

  // Google Drive / Docs viewers → /preview form.
  if (host === "drive.google.com" || host === "docs.google.com") {
    const match = url.pathname.match(
      /^\/(?:file\/d|document\/d|presentation\/d|spreadsheets\/d)\/([\w-]+)/,
    );
    if (match) {
      const kindPath = url.pathname.split("/")[1];
      return {
        src: `https://${host}/${kindPath}/d/${match[1]}/preview`,
        kind: "drive",
      };
    }
    return null;
  }

  // Any https PDF renders in the browser's viewer.
  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    return { src: url.toString(), kind: "pdf" };
  }

  return null;
}
