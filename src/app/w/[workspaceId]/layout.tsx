import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar/sidebar";
import { AppShell } from "@/components/sidebar/app-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [
    { data: workspaces },
    { data: workspace },
    { data: membership },
    { data: pages },
    { data: favourites },
    { data: recents },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, icon, is_personal")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("workspaces")
      .select("id, name, icon, is_personal")
      .eq("id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("pages")
      .select(
        "id, parent_page_id, position, title, icon, is_private, created_by",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase
      .from("favourites")
      .select("page_id, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("recent_pages")
      .select("page_id, viewed_at")
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(5),
  ]);

  if (!workspace || !membership) notFound();

  const pageById = new Map((pages ?? []).map((p) => [p.id, p]));
  const favouritePages = (favourites ?? [])
    .map((f) => pageById.get(f.page_id))
    .filter((p) => p !== undefined);
  const recentPages = (recents ?? [])
    .map((r) => pageById.get(r.page_id))
    .filter((p) => p !== undefined);

  return (
    <AppShell
      workspaceName={workspace.name}
      sidebar={
        <Sidebar
          userId={user.id}
          workspaces={workspaces ?? []}
          currentWorkspace={workspace}
          role={membership.role}
          pages={pages ?? []}
          favourites={favouritePages}
          recents={recentPages}
        />
      }
    >
      {children}
    </AppShell>
  );
}
