/**
 * Why an invitation could not be accepted, and what to tell the person.
 * `accept_invite` (migration 0028) raises with a stable reason in the
 * error DETAIL and an SQLSTATE of class "IV"; this maps either to a
 * reason, with the pre-0028 messages as a fallback until the migration is
 * everywhere, and the reason to copy the invite page shows. Pure, so the
 * mapping is unit-tested.
 */

export const INVITE_FAILURE_REASONS = [
  "not_found",
  "expired",
  "wrong_email",
  "already_used_by_other",
  "already_used",
  "not_signed_in",
  "unknown",
] as const;

export type InviteFailureReason = (typeof INVITE_FAILURE_REASONS)[number];

const BY_SQLSTATE: Record<string, InviteFailureReason> = {
  IV401: "not_signed_in",
  IV403: "wrong_email",
  IV404: "not_found",
  IV409: "already_used_by_other",
  IV410: "expired",
};

function isReason(value: unknown): value is InviteFailureReason {
  return (
    typeof value === "string" &&
    (INVITE_FAILURE_REASONS as readonly string[]).includes(value)
  );
}

/** The reason behind an `accept_invite` error, as PostgREST reports it. */
export function inviteFailureReason(error: {
  code?: string | null;
  details?: string | null;
  message?: string | null;
}): InviteFailureReason {
  const detail = error.details?.trim();
  if (isReason(detail)) return detail;
  const byCode = error.code ? BY_SQLSTATE[error.code] : undefined;
  if (byCode) return byCode;
  // Messages raised before migration 0028.
  const message = error.message ?? "";
  if (/expired/i.test(message)) return "expired";
  if (/different email/i.test(message)) return "wrong_email";
  if (/not found or already used/i.test(message)) return "not_found";
  if (/sign in to accept/i.test(message)) return "not_signed_in";
  return "unknown";
}

export interface InviteFailureCopy {
  title: string;
  body: string;
  /** Only when the fix is to sign in with the invited address. */
  showSignOut: boolean;
}

/** What the invite page says for a reason; `message` is the raw error, used for `unknown`. */
export function inviteFailureCopy(
  reason: InviteFailureReason,
  message?: string | null,
): InviteFailureCopy {
  switch (reason) {
    case "not_found":
      return {
        title: "This invitation link isn't valid",
        body: "The link may be incomplete, or the invitation may have been revoked. Ask the person who invited you to send a new one.",
        showSignOut: false,
      };
    case "expired":
      return {
        title: "This invitation has expired",
        body: "Invitations last seven days. Ask the person who invited you to send a new one.",
        showSignOut: false,
      };
    case "wrong_email":
      return {
        title: "This invitation was sent to a different email address",
        body: "Invitations only work for the address they were sent to. Sign out, sign in with the invited address, then open the link again.",
        showSignOut: true,
      };
    case "already_used_by_other":
      return {
        title: "This invitation has already been used",
        body: "Someone else accepted it. Ask the person who invited you to send a new link for your address.",
        showSignOut: false,
      };
    case "already_used":
      return {
        title: "This invitation has already been used",
        body: "It was accepted earlier and cannot grant access again. Ask the person who invited you to send a new one.",
        showSignOut: false,
      };
    case "not_signed_in":
      return {
        title: "Sign in to accept this invitation",
        body: "Sign in with the address the invitation was sent to, then open the link again.",
        showSignOut: false,
      };
    case "unknown":
      return {
        title: "The invitation could not be accepted",
        body: message?.trim()
          ? `${message.trim()}. Try the link again; if it keeps failing, ask the person who invited you for a new one.`
          : "Try the link again; if it keeps failing, ask the person who invited you for a new one.",
        showSignOut: false,
      };
  }
}
