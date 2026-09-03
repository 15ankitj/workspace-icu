import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTree } from "@/lib/tree";
import { EmptyWorkspaceActions } from "./empty-workspace-actions";

export const dynamic = "force-dynamic";

/** Workspace home: open the first page, or show the empty state. */
export default async function WorkspaceHome({
  params,
}: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: pages } = await supabase
    .from("pages")
    .select("id, parent_page_id, position, title, icon, is_private, created_by")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  const tree = buildTree(pages ?? []);
  const first = tree.at(0);
  if (first) redirect(`/w/${workspaceId}/p/${first.page.id}`);

  const [{ data: workspace }, { data: membership }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!workspace) notFound();
  const canEdit = membership?.role === "owner" || membership?.role === "editor";

  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center"
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {workspace.name}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This workspace is empty. Start with a blank page, or pick a template
          from the gallery.
        </p>
      </div>
      <EmptyWorkspaceActions workspaceId={workspaceId} canEdit={canEdit} />
    </main>
  );
}
