import { describe, expect, it } from "vitest";
import { resolveEmbedUrl } from "@/lib/embed";

describe("resolveEmbedUrl", () => {
  it("converts YouTube watch URLs to the privacy-enhanced embed", () => {
    expect(
      resolveEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toEqual({
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      kind: "youtube",
    });
  });

  it("handles youtu.be short links and shorts", () => {
    expect(resolveEmbedUrl("https://youtu.be/dQw4w9WgXcQ")?.src).toContain(
      "/embed/dQw4w9WgXcQ",
    );
    expect(
      resolveEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.src,
    ).toContain("/embed/dQw4w9WgXcQ");
  });

  it("converts Drive file links to the preview form", () => {
    expect(
      resolveEmbedUrl("https://drive.google.com/file/d/abc123XYZ_-/view"),
    ).toEqual({
      src: "https://drive.google.com/file/d/abc123XYZ_-/preview",
      kind: "drive",
    });
  });

  it("accepts Google Docs links", () => {
    expect(
      resolveEmbedUrl("https://docs.google.com/document/d/abc123/edit"),
    ).toEqual({
      src: "https://docs.google.com/document/d/abc123/preview",
      kind: "drive",
    });
  });

  it("accepts https PDFs", () => {
    expect(resolveEmbedUrl("https://example.org/paper.PDF")).toEqual({
      src: "https://example.org/paper.PDF",
      kind: "pdf",
    });
  });

  it("rejects everything else", () => {
    expect(resolveEmbedUrl("https://example.org/")).toBeNull();
    expect(
      resolveEmbedUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
    expect(resolveEmbedUrl("https://evil.test/video.mp4")).toBeNull();
    expect(resolveEmbedUrl("not a url")).toBeNull();
    expect(resolveEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
