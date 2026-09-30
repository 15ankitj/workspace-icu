"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  ok,
  runAction,
  type ActionResult,
} from "@/lib/action-result";
import { isAllowedUpload } from "@/lib/files";
import { isTextScannable, scanTextForPhi, type PhiFinding } from "@/lib/phi";
import { AUP_VERSION } from "@/lib/aup";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  workspaceId: string,
  eventType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  // Audit writes are best-effort: never fail the user's operation.
  await supabase.from("audit_events").insert({
    actor_id: actorId,
    workspace_id: workspaceId,
    event_type: eventType,
    target_type: "file",
    target_id: targetId,
    metadata,
  });
}

/**
 * Step 1 of an upload: validate and create the file row. The client then
 * uploads the bytes straight to Storage (server bodies are too small for
 * 25 MB); storage RLS and the bucket's size/MIME limits enforce the same
 * constraints server-side.
 */
export async function registerUpload(
  pageId: string,
  meta: { filename: string; mime: string; sizeBytes: number },
): Promise<ActionResult<{ fileId: string; storagePath: string }>> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();

    const rejection = isAllowedUpload(meta.mime, meta.sizeBytes);
    if (rejection) return fail(rejection);

    // Brief §12: rate-limit uploads (60 per hour per user; the limit and
    // window live in the database function).
    const { data: allowed } = await supabase.rpc("consume_rate_limit", {
      p_action: "file_upload",
    });
    if (allowed === false) {
      return fail(
        "Too many uploads in the last hour — try again later",
        "rate_limited",
      );
    }

    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id, workspace_id")
      .eq("id", pageId)
      .is("deleted_at", null)
      .single();
    if (pageError || !page) return fail("Page not found");

    const fileId = randomUUID();
    const storagePath = `${page.workspace_id}/${pageId}/${fileId}`;

    const { error } = await supabase.from("files").insert({
      id: fileId,
      workspace_id: page.workspace_id,
      page_id: pageId,
      uploader_id: user.id,
      storage_path: storagePath,
      filename: meta.filename.slice(0, 300),
      mime: meta.mime,
      size_bytes: meta.sizeBytes,
      aup_acknowledged: true, // the upload gate was shown before this call
    });
    if (error) return fromSupabaseError(error);

    return ok({ fileId, storagePath });
  });
}

export interface FinalizeResult {
  status: "clear" | "flagged" | "not_scanned";
  findings: PhiFinding[];
}

/**
 * Step 2: after the bytes are in Storage, run the advisory PHI scan on
 * text-extractable files and record the outcome. Advisory only — the file
 * stays available whatever the result (brief §9).
 */
export async function finalizeUpload(
  fileId: string,
): Promise<ActionResult<FinalizeResult>> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();

    const { data: file, error } = await supabase
      .from("files")
      .select("id, workspace_id, mime, storage_path, filename")
      .eq("id", fileId)
      .single();
    if (error || !file) return fail("File not found");

    let status: FinalizeResult["status"] = "not_scanned";
    let findings: PhiFinding[] = [];

    if (isTextScannable(file.mime)) {
      const { data: blob } = await supabase.storage
        .from("files")
        .download(file.storage_path);
      if (blob) {
        const text = await blob.text();
        findings = scanTextForPhi(text);
        status = findings.length > 0 ? "flagged" : "clear";
      }
    }

    await supabase
      .from("files")
      .update({
        phi_scan_status: status === "not_scanned" ? "not_scanned" : status,
        phi_scan_findings: findings,
      })
      .eq("id", fileId);

    await logAudit(
      supabase,
      user.id,
      file.workspace_id,
      "file_uploaded",
      fileId,
      {
        filename: file.filename,
        mime: file.mime,
        phi_scan_status: status,
        aup_version: AUP_VERSION,
      },
    );

    return ok({ status, findings });
  });
}

/** "I confirm this is anonymised" on a flagged file (records overridden). */
export async function overridePhiFindings(
  fileId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("files")
      .update({ phi_scan_status: "overridden" })
      .eq("id", fileId)
      .eq("phi_scan_status", "flagged")
      .select("workspace_id")
      .single();
    if (error) return fromSupabaseError(error);
    await logAudit(
      supabase,
      user.id,
      data.workspace_id,
      "phi_scan_overridden",
      fileId,
    );
    return ok();
  });
}

/** Soft-delete a file and remove its bytes from Storage. */
export async function deleteFile(fileId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", fileId)
      .select("workspace_id, storage_path, filename")
      .single();
    if (error) return fromSupabaseError(error);

    await supabase.storage.from("files").remove([data.storage_path]);
    await logAudit(
      supabase,
      user.id,
      data.workspace_id,
      "file_deleted",
      fileId,
      {
        filename: data.filename,
      },
    );
    return ok();
  });
}

/** How many live uploads this user has made (drives the checkbox gate). */
export async function countMyUploads(): Promise<
  ActionResult<{ count: number }>
> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();
    const { count, error } = await supabase
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("uploader_id", user.id)
      .is("deleted_at", null);
    if (error) return fromSupabaseError(error);
    return ok({ count: count ?? 0 });
  });
}
