import { describe, expect, it } from "vitest";
import {
  INVITE_FAILURE_REASONS,
  inviteFailureCopy,
  inviteFailureReason,
} from "@/lib/invites";

describe("inviteFailureReason", () => {
  it("reads the stable reason from DETAIL first", () => {
    expect(
      inviteFailureReason({
        code: "IV404",
        details: "not_found",
        message: "invitation not found",
      }),
    ).toBe("not_found");
    expect(
      inviteFailureReason({ code: "IV410", details: "expired", message: "x" }),
    ).toBe("expired");
    expect(
      inviteFailureReason({
        code: "IV403",
        details: "wrong_email",
        message: "x",
      }),
    ).toBe("wrong_email");
    expect(
      inviteFailureReason({
        code: "IV409",
        details: "already_used_by_other",
        message: "x",
      }),
    ).toBe("already_used_by_other");
    // Same SQLSTATE, different reason: DETAIL decides.
    expect(
      inviteFailureReason({
        code: "IV409",
        details: "already_used",
        message: "x",
      }),
    ).toBe("already_used");
  });

  it("falls back to the SQLSTATE when DETAIL is missing", () => {
    expect(inviteFailureReason({ code: "IV404" })).toBe("not_found");
    expect(inviteFailureReason({ code: "IV410" })).toBe("expired");
    expect(inviteFailureReason({ code: "IV403" })).toBe("wrong_email");
    expect(inviteFailureReason({ code: "IV409" })).toBe(
      "already_used_by_other",
    );
    expect(inviteFailureReason({ code: "IV401" })).toBe("not_signed_in");
  });

  it("understands the messages raised before migration 0028", () => {
    expect(
      inviteFailureReason({
        code: "P0001",
        message: "invitation not found or already used",
      }),
    ).toBe("not_found");
    expect(
      inviteFailureReason({ code: "P0001", message: "invitation has expired" }),
    ).toBe("expired");
    expect(
      inviteFailureReason({
        code: "P0001",
        message: "this invitation was sent to a different email address",
      }),
    ).toBe("wrong_email");
    expect(
      inviteFailureReason({ code: "P0001", message: "something else" }),
    ).toBe("unknown");
    expect(inviteFailureReason({})).toBe("unknown");
  });
});

describe("inviteFailureCopy", () => {
  it("advises signing out only for the wrong address", () => {
    for (const reason of INVITE_FAILURE_REASONS) {
      const copy = inviteFailureCopy(reason);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.showSignOut).toBe(reason === "wrong_email");
    }
    expect(inviteFailureCopy("wrong_email").body).toMatch(/sign out/i);
  });

  it("tells the person to ask the inviter for a new link when the invitation is spent", () => {
    expect(inviteFailureCopy("already_used_by_other").body).toMatch(
      /ask the person who invited you/i,
    );
    expect(inviteFailureCopy("already_used").body).toMatch(
      /ask the person who invited you/i,
    );
    expect(inviteFailureCopy("expired").body).toMatch(
      /ask the person who invited you/i,
    );
    expect(inviteFailureCopy("not_found").body).toMatch(
      /ask the person who invited you/i,
    );
  });

  it("keeps the raw message for an unknown failure", () => {
    expect(inviteFailureCopy("unknown", "network down").body).toContain(
      "network down",
    );
    expect(inviteFailureCopy("unknown").body).toMatch(/try the link again/i);
  });
});
