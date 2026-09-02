/**
 * Transactional email through Resend's REST API (brief §12). Server-only:
 * the API key comes from platform settings and is never sent to the
 * browser. Until a sending domain is verified, Resend's sandbox sender
 * (`onboarding@resend.dev`) only delivers to the account owner's address.
 */

const RESEND_API = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email is not configured");
  const from =
    process.env.RESEND_FROM ?? "WorkspaceICU <onboarding@resend.dev>";

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, ...message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email could not be sent (${response.status}) ${detail}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function inviteEmail(input: {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
}): EmailMessage {
  const subject = `${input.inviterName} invited you to ${input.workspaceName} on WorkspaceICU`;
  const text = [
    `${input.inviterName} has invited you to join the workspace "${input.workspaceName}" as ${input.role}.`,
    "",
    `Accept the invitation: ${input.acceptUrl}`,
    "",
    "The link expires in 7 days and only works for this email address.",
    "",
    "WorkspaceICU is not a clinical record — please never add patient-identifiable information.",
  ].join("\n");
  const html = `
    <p>${escapeHtml(input.inviterName)} has invited you to join the workspace
    <strong>${escapeHtml(input.workspaceName)}</strong> as ${escapeHtml(input.role)}.</p>
    <p><a href="${escapeHtml(input.acceptUrl)}">Accept the invitation</a></p>
    <p style="color:#666;font-size:12px">The link expires in 7 days and only works for this
    email address. WorkspaceICU is not a clinical record — please never add
    patient-identifiable information.</p>`;
  return { to: input.to, subject, text, html };
}
