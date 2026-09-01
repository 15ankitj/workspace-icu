import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTree } from "@/lib/tree";

export const dynamic = "force-dynamic";

/** Workspace home: open the first page, or show the empty state. */
export default async function WorkspaceHome({
  params,
}: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const { data: pages } = await supabase
    .from("pages")
    .select("id, parent_page_id, position, title, icon, is_private, created_by")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  const tree = buildTree(pages ?? []);
  const first = tree.at(0);
  if (first) redirect(`/w/${workspaceId}/p/${first.page.id}`);

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">{workspace.name}</h1>
      <p className="text-sm text-muted-foreground">
        This workspace is empty. Create a page from the sidebar to get started.
      </p>
    </main>
  );
}
