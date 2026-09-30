import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  CONFLICT_ERROR,
  GENERIC_ERROR,
  NOT_FOUND_ERROR,
  PERMISSION_ERROR,
  RATE_LIMIT_ERROR,
  fail,
  fromSupabaseError,
  ok,
  runAction,
  sentence,
} from "./action-result";

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
});

describe("ok / fail", () => {
  it("carries data on success and a sentence on failure", () => {
    expect(ok()).toEqual({ ok: true });
    expect(ok({ pageId: "p1" })).toEqual({ ok: true, pageId: "p1" });
    expect(fail("only the page author can resolve suggestions")).toEqual({
      ok: false,
      error: "Only the page author can resolve suggestions.",
    });
    expect(fail("Not found", "not_found")).toEqual({
      ok: false,
      error: "Not found.",
      code: "not_found",
    });
  });

  it("makes a complete sentence without doubling punctuation", () => {
    expect(sentence("invitation not found")).toBe("Invitation not found.");
    expect(sentence("Already done.")).toBe("Already done.");
    expect(sentence("Really?")).toBe("Really?");
    expect(sentence("Type “delete my account” to confirm")).toBe(
      "Type “delete my account” to confirm.",
    );
    expect(sentence("  spaced   out ")).toBe("Spaced out.");
    expect(sentence("")).toBe(GENERIC_ERROR);
  });
});

describe("fromSupabaseError", () => {
  it("maps permission refusals, including RLS violations", () => {
    expect(
      fromSupabaseError({ code: "42501", message: "permission denied" }),
    ).toEqual({
      ok: false,
      error: PERMISSION_ERROR,
      code: "permission_denied",
    });
    expect(
      fromSupabaseError({
        code: "42501",
        message: 'new row violates row-level security policy for table "pages"',
      }).error,
    ).toBe(PERMISSION_ERROR);
    expect(fromSupabaseError({ status: 403, message: "forbidden" }).error).toBe(
      PERMISSION_ERROR,
    );
    expect(logged).not.toHaveBeenCalled();
  });

  it("maps duplicates, missing rows and rate limits", () => {
    expect(
      fromSupabaseError({ code: "23505", message: "duplicate key" }),
    ).toEqual({ ok: false, error: CONFLICT_ERROR, code: "conflict" });
    expect(
      fromSupabaseError({ code: "PGRST116", message: "JSON object requested" }),
    ).toEqual({ ok: false, error: NOT_FOUND_ERROR, code: "not_found" });
    expect(
      fromSupabaseError({ status: 429, message: "Too Many Requests" }),
    ).toEqual({ ok: false, error: RATE_LIMIT_ERROR, code: "rate_limited" });
    expect(
      fromSupabaseError({
        message: "Request rate limit reached",
        code: "over_request_rate_limit",
      }).error,
    ).toBe(RATE_LIMIT_ERROR);
    expect(
      fromSupabaseError({ statusCode: "404", message: "Object not found" })
        .error,
    ).toBe(NOT_FOUND_ERROR);
  });

  it("passes our own raised messages through as sentences", () => {
    expect(
      fromSupabaseError({
        code: "P0001",
        message: "only the page author can resolve suggestions",
      }),
    ).toEqual({
      ok: false,
      error: "Only the page author can resolve suggestions.",
      code: "refused",
    });
    expect(
      fromSupabaseError({
        code: "P0001",
        message:
          "authored_content: only the page author can change its text — suggest instead",
      }),
    ).toEqual({
      ok: false,
      error: "Only the page author can change its text — suggest instead.",
      code: "authored_content",
    });
  });

  it("hides anything else behind the generic message and logs it", () => {
    expect(
      fromSupabaseError({
        code: "22001",
        message: "value too long for type character varying(3)",
      }),
    ).toEqual({ ok: false, error: GENERIC_ERROR, code: "unexpected" });
    expect(fromSupabaseError(new Error("ECONNRESET")).error).toBe(
      GENERIC_ERROR,
    );
    expect(fromSupabaseError("boom").error).toBe(GENERIC_ERROR);
    expect(logged).toHaveBeenCalledTimes(3);
    // Code and message only: no request body or content is logged.
    expect(JSON.stringify(logged.mock.calls[0])).toContain("22001");
  });
});

describe("runAction", () => {
  it("returns what the body returns", async () => {
    await expect(runAction(async () => ok({ n: 1 }))).resolves.toEqual({
      ok: true,
      n: 1,
    });
    await expect(runAction(async () => fail("no"))).resolves.toEqual({
      ok: false,
      error: "No.",
    });
  });

  it("converts a thrown Postgrest error", async () => {
    const thrown = Object.assign(new Error("permission denied for table x"), {
      name: "PostgrestError",
      code: "42501",
      details: "",
      hint: "",
    });
    await expect(
      runAction(async () => {
        throw thrown;
      }),
    ).resolves.toEqual({
      ok: false,
      error: PERMISSION_ERROR,
      code: "permission_denied",
    });
  });

  it("returns the generic failure for an unknown error", async () => {
    await expect(
      runAction(async () => {
        throw new Error("something internal: /var/secret");
      }),
    ).resolves.toEqual({ ok: false, error: GENERIC_ERROR, code: "unexpected" });
  });

  it("rethrows a redirect unchanged", async () => {
    let caught: unknown;
    try {
      await runAction(async () => {
        redirect("/sign-in");
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as { digest?: string }).digest).toMatch(/^NEXT_REDIRECT/);
  });
});
