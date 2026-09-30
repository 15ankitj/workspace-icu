"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  ok,
  runAction,
  type ActionResult,
} from "@/lib/action-result";

/**
 * Report a page to the platform owner (brief §9 nudge 4). The report is
 * stored for owner review; quarantine/removal is an owner action.
 */
export async function reportPage(
  pageId: string,
  reason: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const trimmed = reason.trim().slice(0, 2000);
    if (!trimmed) return fail("Please say what you are reporting");

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
    if (pageError || !page) return fail("Page not found");

    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      page_id: pageId,
      reason: trimmed,
    });
    if (error) return fromSupabaseError(error);

    await supabase.from("audit_events").insert({
      actor_id: user.id,
      workspace_id: page.workspace_id,
      event_type: "content_reported",
      target_type: "page",
      target_id: pageId,
    });
    return ok();
  });
}
