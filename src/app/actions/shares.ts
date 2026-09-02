"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/**
 * Public read-only link per page (brief §4): enabling creates the token
 * on first use; disabling keeps the row but revokes access. Both are
 * audited as sharing events.
 */
export async function setPublicLink(
  pageId: string,
  enabled: boolean,
): Promise<{ token: string | null }> {
  const { supabase, user } = await requireUser();

  const { data: page } = await supabase
    .from("pages")
    .select("workspace_id")
    .eq("id", pageId)
    .single();
  if (!page) throw new Error("Page not found");

  const { data: share, error } = await supabase
    .from("page_shares")
    .upsert(
      { page_id: pageId, created_by: user.id, public_enabled: enabled },
      { onConflict: "page_id" },
    )
    .select("public_token, public_enabled")
    .single();
  if (error) throw new Error(`Could not update sharing: ${error.message}`);

  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: page.workspace_id,
    event_type: enabled ? "public_link_enabled" : "public_link_disabled",
    target_type: "page",
    target_id: pageId,
  });

  revalidatePath(`/w/${page.workspace_id}/p/${pageId}`);
  return { token: share.public_enabled ? share.public_token : null };
}
