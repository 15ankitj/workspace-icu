import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildDigest,
  type DigestRow,
  type NotificationKind,
} from "@/lib/digest";
import { digestEmail, isEmailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Daily suggestion digest (Appendix A §2.5): one email per person with
 * unread, not-yet-emailed notifications, grouped by workspace and page.
 * Scheduled by vercel.json; Vercel sends CRON_SECRET as the bearer token.
 * Service role, because it spans every workspace and serves no request.
 * People who switched the digest off get nothing, but their rows are
 * closed out too so the backlog never grows.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await admin
    .from("notifications")
    .select(
      "id, user_id, workspace_id, page_id, kind, read_at, workspaces (name), pages (title), recipient:users!notifications_user_id_fkey(email, display_name, email_digest), actor:users!notifications_actor_id_fkey(display_name)",
    )
    .is("emailed_at", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 },
    );
  }

  type Row = {
    id: string;
    user_id: string;
    workspace_id: string;
    page_id: string;
    kind: NotificationKind;
    read_at: string | null;
    workspaces: { name: string } | null;
    pages: { title: string } | null;
    recipient: {
      email: string;
      display_name: string;
      email_digest: boolean;
    } | null;
    actor: { display_name: string } | null;
  };
  const all = (rows ?? []) as unknown as Row[];

  const byUser = new Map<string, Row[]>();
  for (const row of all) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const summary = { recipients: 0, sent: 0, skipped: 0, closed: 0, failed: 0 };
  const processed: string[] = [];

  for (const [, list] of byUser) {
    summary.recipients += 1;
    const recipient = list[0].recipient;
    const unread = list.filter((r) => !r.read_at);
    const wants = Boolean(recipient?.email && recipient.email_digest);
    if (wants && unread.length > 0 && isEmailConfigured()) {
      const digest = buildDigest(
        unread.map<DigestRow>((r) => ({
          workspaceId: r.workspace_id,
          workspaceName: r.workspaces?.name ?? "Workspace",
          pageId: r.page_id,
          pageTitle: r.pages?.title ?? "",
          kind: r.kind,
          actorName: r.actor?.display_name ?? null,
        })),
      );
      try {
        await sendEmail(
          digestEmail({
            to: recipient!.email,
            recipientName: recipient!.display_name || "there",
            workspaces: digest,
            appUrl,
          }),
        );
        summary.sent += 1;
      } catch (error) {
        console.error("Digest email failed:", error);
        summary.failed += 1;
        // Leave this person's rows open so the next run retries.
        continue;
      }
    } else {
      summary.skipped += 1;
    }
    for (const row of list) processed.push(row.id);
  }

  for (let i = 0; i < processed.length; i += 500) {
    const { error: closeError } = await admin
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in("id", processed.slice(i, i + 500));
    if (!closeError) summary.closed += Math.min(500, processed.length - i);
  }

  return NextResponse.json({ ok: true, ...summary });
}
