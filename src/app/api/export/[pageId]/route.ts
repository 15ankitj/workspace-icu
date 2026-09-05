import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeFilename } from "@/lib/export";
import { buildArchive } from "@/lib/export-archive";
import { descendantIds } from "@/lib/tree";

export const dynamic = "force-dynamic";

/**
 * Markdown export (brief §5): a page (`?tree=1` for its descendants too)
 * as a zip of Markdown files with attached files alongside.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/export/[pageId]">,
) {
  const { pageId } = await ctx.params;
  const tree = request.nextUrl.searchParams.get("tree") === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const { data: root } = await supabase
    .from("pages")
    .select("id, workspace_id, title")
    .eq("id", pageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!root) return new Response("Not found", { status: 404 });

  const { data: allPages } = await supabase
    .from("pages")
    .select(
      "id, parent_page_id, position, title, icon, is_private, created_by, description",
    )
    .eq("workspace_id", root.workspace_id)
    .is("deleted_at", null);
  const pages = allPages ?? [];
  const include = tree
    ? new Set([root.id, ...descendantIds(pages, root.id)])
    : new Set([root.id]);
  const selected = pages
    .filter((p) => include.has(p.id))
    .map((p) => ({
      ...p,
      parent_page_id: p.id === root.id ? null : p.parent_page_id,
    }));

  const zip = await buildArchive(supabase, selected, root.id, pages);
  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: root.workspace_id,
    event_type: "page_exported",
    target_type: "page",
    target_id: root.id,
    metadata: { tree, pages: selected.length },
  });

  const name = `${safeFilename(root.title)}${tree ? "-tree" : ""}.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}
