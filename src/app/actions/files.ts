"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
): Promise<{ fileId: string; storagePath: string }> {
  const { supabase, user } = await requireUser();

  const rejection = isAllowedUpload(meta.mime, meta.sizeBytes);
  if (rejection) throw new Error(rejection);

  // Brief §12: rate-limit uploads (60 per hour per user).
  const { data: allowed } = await supabase.rpc("consume_rate_limit", {
    p_action: "file_upload",
    p_limit: 60,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    throw new Error("Too many uploads in the last hour — try again later");
  }

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id, workspace_id")
    .eq("id", pageId)
    .is("deleted_at", null)
    .single();
  if (pageError || !page) throw new Error("Page not found");

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
  if (error) throw new Error(`Could not register upload: ${error.message}`);

  return { fileId, storagePath };
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
export async function finalizeUpload(fileId: string): Promise<FinalizeResult> {
  const { supabase, user } = await requireUser();

  const { data: file, error } = await supabase
    .from("files")
    .select("id, workspace_id, mime, storage_path, filename")
    .eq("id", fileId)
    .single();
  if (error || !file) throw new Error("File not found");

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

  return { status, findings };
}

/** "I confirm this is anonymised" on a flagged file (records overridden). */
export async function overridePhiFindings(fileId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("files")
    .update({ phi_scan_status: "overridden" })
    .eq("id", fileId)
    .eq("phi_scan_status", "flagged")
    .select("workspace_id")
    .single();
  if (error) throw new Error(`Could not record confirmation: ${error.message}`);
  await logAudit(
    supabase,
    user.id,
    data.workspace_id,
    "phi_scan_overridden",
    fileId,
  );
}

/** Soft-delete a file and remove its bytes from Storage. */
export async function deleteFile(fileId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", fileId)
    .select("workspace_id, storage_path, filename")
    .single();
  if (error) throw new Error(`Could not delete file: ${error.message}`);

  await supabase.storage.from("files").remove([data.storage_path]);
  await logAudit(supabase, user.id, data.workspace_id, "file_deleted", fileId, {
    filename: data.filename,
  });
}

/** How many live uploads this user has made (drives the checkbox gate). */
export async function countMyUploads(): Promise<number> {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("uploader_id", user.id)
    .is("deleted_at", null);
  return count ?? 0;
}
