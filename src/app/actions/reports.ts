"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Report a page to the platform owner (brief §9 nudge 4). The report is
 * stored for owner review; quarantine/removal is an owner action.
 */
export async function reportPage(pageId: string, reason: string) {
  const trimmed = reason.trim().slice(0, 2000);
  if (!trimmed) throw new Error("Please say what you are reporting");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id, workspace_id")
    .eq("id", pageId)
    .single();
  if (pageError || !page) throw new Error("Page not found");

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    page_id: pageId,
    reason: trimmed,
  });
  if (error) throw new Error(`Could not submit report: ${error.message}`);

  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: page.workspace_id,
    event_type: "content_reported",
    target_type: "page",
    target_id: pageId,
  });
}
