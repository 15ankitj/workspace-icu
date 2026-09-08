import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { roomIdForPage } from "@/lib/collab";
import { deleteLiveblocksRoom } from "@/lib/liveblocks-admin";
import { roomIdForSyncedBlock } from "@/lib/synced";

export const dynamic = "force-dynamic";

const TRASH_DAYS = 30;
const VERSION_DAYS = 90;

/**
 * Nightly purge (brief §7, §9): trashed pages, files and workspaces older
 * than 30 days are removed for good, and page history older than 90 days
 * is pruned. Scheduled by vercel.json; Vercel sends the CRON_SECRET as a
 * bearer token.
 *
 * This is the one place the service role is used, and it serves no end
 * user: the job runs across all workspaces, which no user's RLS allows.
 * The key comes only from the Vercel environment.
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

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const summary = {
    pages: 0,
    files: 0,
    workspaces: 0,
    versions: 0,
    syncedRooms: 0,
    syncedTombstones: 0,
    suggestions: 0,
    notifications: 0,
  };

  async function removeObjects(paths: string[]) {
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from("files").remove(paths.slice(i, i + 100));
    }
  }

  // Trashed pages (and everything under them via cascade).
  const { data: pages } = await admin
    .from("pages")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(500);
  const pageIds: string[] = (pages ?? []).map((p: { id: string }) => p.id);
  if (pageIds.length > 0) {
    const { data: files } = await admin
      .from("files")
      .select("storage_path")
      .in("page_id", pageIds);
    await removeObjects(
      (files ?? []).map((f: { storage_path: string }) => f.storage_path),
    );
    // Synced blocks sourced from these pages become tombstones by trigger.
    const { error } = await admin.from("pages").delete().in("id", pageIds);
    if (!error) {
      summary.pages = pageIds.length;
      for (const id of pageIds) await deleteLiveblocksRoom(roomIdForPage(id));
    }
  }

  // Synced-block tombstones (Appendix A §1.3 rule 7): their rooms upstream
  // still hold the content until deleted, then the rows themselves go once
  // nothing places them any more.
  const { data: tombstones } = await admin
    .from("synced_blocks")
    .select("id")
    .not("deleted_at", "is", null)
    .is("content_purged_at", null)
    .limit(200);
  for (const row of (tombstones ?? []) as { id: string }[]) {
    if (await deleteLiveblocksRoom(roomIdForSyncedBlock(row.id))) {
      const { error } = await admin
        .from("synced_blocks")
        .update({ content_purged_at: new Date().toISOString() })
        .eq("id", row.id);
      if (!error) summary.syncedRooms += 1;
    }
  }
  const { data: purgedTombstones } = await admin.rpc(
    "purge_synced_tombstones",
    { p_cutoff: cutoff },
  );
  summary.syncedTombstones = purgedTombstones ?? 0;

  // Individually deleted files (bytes were removed at deletion; rows go now).
  const { data: deadFiles } = await admin
    .from("files")
    .select("id, storage_path")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(1000);
  if (deadFiles && deadFiles.length > 0) {
    await removeObjects(
      deadFiles.map((f: { storage_path: string }) => f.storage_path),
    );
    const ids = deadFiles.map((f: { id: string }) => f.id);
    const { error } = await admin.from("files").delete().in("id", ids);
    if (!error) summary.files = ids.length;
  }

  // Trashed workspaces.
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(50);
  for (const workspace of (workspaces ?? []) as { id: string }[]) {
    const { data: files } = await admin
      .from("files")
      .select("storage_path")
      .eq("workspace_id", workspace.id);
    await removeObjects(
      (files ?? []).map((f: { storage_path: string }) => f.storage_path),
    );
    const { error } = await admin
      .from("workspaces")
      .delete()
      .eq("id", workspace.id);
    if (!error) summary.workspaces += 1;
  }

  // Resolved-suggestion detail (Appendix A §2.3): the audit pair stays,
  // the excerpt and reason go with page history at 90 days.
  const suggestionCutoff = new Date(
    Date.now() - VERSION_DAYS * 86_400_000,
  ).toISOString();
  const { data: resolvedSuggestions } = await admin
    .from("page_suggestions")
    .delete()
    .neq("status", "open")
    .lt("resolved_at", suggestionCutoff)
    .select("id");
  summary.suggestions = resolvedSuggestions?.length ?? 0;

  const { data: oldNotifications } = await admin
    .from("notifications")
    .delete()
    .lt("created_at", suggestionCutoff)
    .select("id");
  summary.notifications = oldNotifications?.length ?? 0;

  // Page history retention (brief §8: 90 days).
  const versionCutoff = new Date(
    Date.now() - VERSION_DAYS * 86_400_000,
  ).toISOString();
  const { data: versions } = await admin
    .from("page_document_versions")
    .delete()
    .lt("created_at", versionCutoff)
    .select("id");
  summary.versions = versions?.length ?? 0;

  await admin.from("audit_events").insert({
    actor_id: null,
    workspace_id: null,
    event_type: "purge_completed",
    target_type: "system",
    target_id: null,
    metadata: summary,
  });

  return NextResponse.json({ ok: true, ...summary });
}
