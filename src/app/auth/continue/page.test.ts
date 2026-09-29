import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import ContinuePage, { metadata } from "./page";

async function render(params: Record<string, string>) {
  const element = await ContinuePage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(params),
  });
  return renderToStaticMarkup(element);
}

describe("/auth/continue", () => {
  it("renders the token into a POST form and calls nothing", async () => {
    const html = await render({
      token_hash: "abc",
      type: "email",
      next: "/w/abc",
    });
    expect(html).toMatch(
      /<form [^>]*action="\/auth\/confirm"[^>]*method="post"/,
    );
    expect(html).toContain('name="token_hash" value="abc"');
    expect(html).toContain('name="type" value="email"');
    expect(html).toContain('name="next" value="/w/abc"');
    expect(html).toContain("Continue to WorkspaceICU");
    expect(html).toContain("email security scanners");
    expect(html).toContain("Not a clinical record.");
    expect(html).toContain('href="/privacy"');
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("does not carry an off-site next into the form", async () => {
    const html = await render({
      token_hash: "abc",
      type: "email",
      next: "//evil.example",
    });
    expect(html).toContain('name="next" value="/"');
  });

  it("escapes token values", async () => {
    const html = await render({ token_hash: '"><b>x', type: "email" });
    expect(html).not.toContain("<b>x");
    expect(html).toContain("&quot;&gt;&lt;b&gt;x");
  });

  it("asks search engines not to index the page", () => {
    expect(metadata.robots).toBe("noindex");
  });
});
