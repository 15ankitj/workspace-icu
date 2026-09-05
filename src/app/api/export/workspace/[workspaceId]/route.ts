import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeFilename } from "@/lib/export";
import { buildArchive } from "@/lib/export-archive";

export const dynamic = "force-dynamic";

/** Whole-workspace Markdown export (brief §5): every page the caller can see. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/export/workspace/[workspaceId]">,
) {
  const { workspaceId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const [{ data: workspace }, { data: pages }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("pages")
      .select(
        "id, parent_page_id, position, title, icon, is_private, created_by, description",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
  ]);
  if (!workspace) return new Response("Not found", { status: 404 });

  const zip = await buildArchive(supabase, pages ?? [], null, pages ?? []);
  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: workspaceId,
    event_type: "workspace_exported",
    target_type: "workspace",
    target_id: workspaceId,
    metadata: { pages: (pages ?? []).length },
  });

  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${safeFilename(workspace.name, "workspace")}.zip"`,
    },
  });
}
