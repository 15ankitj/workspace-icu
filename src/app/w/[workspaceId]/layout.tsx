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
    { data: pendingRows },
    { data: notificationRows },
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
    // Open suggestions on pages this user can see (Appendix A §2.5).
    supabase
      .from("page_suggestions")
      .select("page_id, pages!inner(workspace_id)")
      .eq("status", "open")
      .eq("pages.workspace_id", workspaceId),
    // This user's recent suggestion activity here.
    supabase
      .from("notifications")
      .select(
        "id, kind, page_id, created_at, read_at, pages (title, icon), actor:users!notifications_actor_id_fkey(display_name)",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!workspace || !membership) notFound();

  const pageById = new Map((pages ?? []).map((p) => [p.id, p]));
  const favouritePages = (favourites ?? [])
    .map((f) => pageById.get(f.page_id))
    .filter((p) => p !== undefined);
  const recentPages = (recents ?? []).flatMap((r) => {
    const page = pageById.get(r.page_id);
    return page ? [{ ...page, viewedAt: r.viewed_at }] : [];
  });

  const pendingByPage: Record<string, number> = {};
  for (const row of pendingRows ?? []) {
    pendingByPage[row.page_id] = (pendingByPage[row.page_id] ?? 0) + 1;
  }
  const updates = (notificationRows ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    pageId: n.page_id,
    pageTitle: n.pages?.title ?? "",
    pageIcon: n.pages?.icon ?? null,
    actorName: n.actor?.display_name ?? null,
    createdAt: n.created_at,
    read: n.read_at !== null,
  }));

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
          updates={updates}
          pendingByPage={pendingByPage}
        />
      }
    >
      {children}
    </AppShell>
  );
}
