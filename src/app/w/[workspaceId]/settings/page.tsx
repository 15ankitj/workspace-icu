import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renameWorkspace } from "@/app/actions/workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettings({
  params,
}: PageProps<"/w/[workspaceId]/settings">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: workspace }, { data: members }, { data: membership }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("id, name, is_personal")
        .eq("id", workspaceId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("workspace_members")
        .select("user_id, role, joined_at, users (display_name, email)")
        .eq("workspace_id", workspaceId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (!workspace || !membership) notFound();

  const isOwner = membership.role === "owner";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-6 md:p-12">
      <h1 className="text-2xl font-semibold">Workspace settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Name</h2>
        {isOwner ? (
          <form action={renameWorkspace} className="flex gap-2">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <Input
              name="name"
              defaultValue={workspace.name}
              required
              className="max-w-sm"
            />
            <Button type="submit" variant="secondary">
              Rename
            </Button>
          </form>
        ) : (
          <p className="text-sm">{workspace.name}</p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Members</h2>
        <ul className="space-y-2">
          {(members ?? []).map((member) => (
            <li
              key={member.user_id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>
                {member.users?.display_name ?? "Unknown"}
                <span className="ml-2 text-muted-foreground">
                  {member.users?.email}
                </span>
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                {member.role}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Email invitations arrive in Phase 5 (Sharing &amp; discovery).
        </p>
      </section>
    </main>
  );
}
