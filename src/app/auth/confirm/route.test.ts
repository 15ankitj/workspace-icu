import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

import { GET, POST } from "./route";

const ORIGIN = "https://icmworkspace.com";

function get(query: string) {
  return GET(new NextRequest(`${ORIGIN}/auth/confirm?${query}`));
}

function post(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return POST(
    new NextRequest(`${ORIGIN}/auth/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

beforeEach(() => {
  verifyOtp.mockReset();
  exchangeCodeForSession.mockReset();
});

describe("GET /auth/confirm", () => {
  it("never verifies a token_hash: it sends the browser to the button page", async () => {
    const response = await get("token_hash=x&type=email&next=%2Fw%2Fabc");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/auth/continue");
    expect(location.searchParams.get("token_hash")).toBe("x");
    expect(location.searchParams.get("type")).toBe("email");
    expect(location.searchParams.get("next")).toBe("/w/abc");
  });

  it("sanitises next before handing it to the button page", async () => {
    const response = await get(
      "token_hash=x&type=email&next=%2F%2Fevil.example",
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/");
  });

  it("still exchanges a PKCE code on GET", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await get("code=abc&next=%2Fw%2Fabc");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/w/abc`);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("passes a Supabase error_description on to the sign-in page", async () => {
    const response = await get("error_description=Email%20link%20is%20invalid");
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/sign-in?error=Email%20link%20is%20invalid`,
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("POST /auth/confirm", () => {
  it("verifies once and redirects (303) to the safe next path", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await post({
      token_hash: "x",
      type: "email",
      next: "/w/abc?tree=1",
    });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "x" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/w/abc?tree=1`);
  });

  it("sends a hostile next to the home page", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    for (const next of ["//evil.example", "https://evil.example"]) {
      const response = await post({ token_hash: "x", type: "email", next });
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/`);
    }
  });

  it("rejects a POST without token_hash before touching Supabase", async () => {
    const response = await post({ type: "email", next: "/" });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(
      new RegExp(`^${ORIGIN}/sign-in\\?error=`),
    );
  });

  it("rejects a POST without type", async () => {
    const response = await post({ token_hash: "x", next: "/" });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toMatch(/\/sign-in\?error=/);
  });

  it("reports a failed verification the way the GET used to", async () => {
    verifyOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });
    const response = await post({ token_hash: "x", type: "email", next: "/" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/sign-in?error=Token%20has%20expired%20or%20is%20invalid`,
    );
  });
});
