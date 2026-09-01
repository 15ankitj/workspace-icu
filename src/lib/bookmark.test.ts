import { describe, expect, it } from "vitest";
import { isFetchableUrl, parseBookmarkMetadata } from "@/lib/bookmark";

describe("isFetchableUrl", () => {
  it("accepts public https URLs", () => {
    expect(isFetchableUrl("https://www.ficm.ac.uk/training")).toBe(true);
  });

  it("rejects http, credentials, and non-URLs", () => {
    expect(isFetchableUrl("http://example.org")).toBe(false);
    expect(isFetchableUrl("https://user:pass@example.org")).toBe(false);
    expect(isFetchableUrl("nonsense")).toBe(false);
  });

  it("rejects private and local hosts", () => {
    expect(isFetchableUrl("https://localhost/x")).toBe(false);
    expect(isFetchableUrl("https://server.local/x")).toBe(false);
    expect(isFetchableUrl("https://10.0.0.5/x")).toBe(false);
    expect(isFetchableUrl("https://192.168.1.1/x")).toBe(false);
    expect(isFetchableUrl("https://172.20.0.1/x")).toBe(false);
    expect(isFetchableUrl("https://169.254.169.254/meta")).toBe(false);
    expect(isFetchableUrl("https://8.8.8.8/x")).toBe(false);
    expect(isFetchableUrl("https://[::1]/x")).toBe(false);
    expect(isFetchableUrl("https://intranet/x")).toBe(false);
  });
});

describe("parseBookmarkMetadata", () => {
  it("prefers OpenGraph fields", () => {
    const html = `<html><head>
      <title>Fallback</title>
      <meta property="og:title" content="GMC guidance &amp; standards">
      <meta property="og:description" content="What good looks like">
    </head></html>`;
    expect(parseBookmarkMetadata(html)).toEqual({
      title: "GMC guidance & standards",
      description: "What good looks like",
    });
  });

  it("falls back to title tag and meta description", () => {
    const html = `<head><title> Plain title </title>
      <meta name="description" content="Plain description"></head>`;
    expect(parseBookmarkMetadata(html)).toEqual({
      title: "Plain title",
      description: "Plain description",
    });
  });

  it("handles reversed attribute order and missing fields", () => {
    const html = `<meta content="Reversed" property="og:title">`;
    expect(parseBookmarkMetadata(html)).toEqual({
      title: "Reversed",
      description: null,
    });
    expect(parseBookmarkMetadata("<p>no head</p>")).toEqual({
      title: null,
      description: null,
    });
  });
});
