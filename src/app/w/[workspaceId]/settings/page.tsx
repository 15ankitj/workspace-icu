import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renameWorkspace } from "@/app/actions/workspaces";
import {
  createInvite,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "@/app/actions/invites";
import { isEmailConfigured } from "@/lib/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function WorkspaceSettings({
  params,
}: PageProps<"/w/[workspaceId]/settings">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [
    { data: workspace },
    { data: members },
    { data: membership },
    { data: invites },
  ] = await Promise.all([
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
    supabase
      .from("workspace_invites")
      .select("id, email, role, token, expires_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: true }),
  ]);
  if (!workspace || !membership) notFound();

  const isOwner = membership.role === "owner";
  const origin = isOwner ? await appOrigin() : "";
  const emailConfigured = isEmailConfigured();

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
        <h2 className="text-sm font-medium text-muted-foreground">Export</h2>
        <p className="text-sm text-muted-foreground">
          Everything you can see in this workspace as Markdown files with
          attachments, in a zip. Accounts belong to individuals: take your
          content with you at any time.
        </p>
        <Button variant="secondary" asChild>
          <a href={`/api/export/workspace/${workspace.id}`}>
            Download workspace export
          </a>
        </Button>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Members</h2>
        <ul className="space-y-2">
          {(members ?? []).map((member) => {
            const manageable =
              isOwner && member.role !== "owner" && member.user_id !== user.id;
            return (
              <li
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  {member.users?.display_name ?? "Unknown"}
                  <span className="ml-2 text-muted-foreground">
                    {member.users?.email}
                  </span>
                </span>
                {manageable ? (
                  <span className="flex items-center gap-2">
                    <form action={updateMemberRole} className="flex gap-1">
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input
                        type="hidden"
                        name="userId"
                        value={member.user_id}
                      />
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        aria-label="Role"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button type="submit" size="sm" variant="secondary">
                        Update
                      </Button>
                    </form>
                    <form action={removeMember}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input
                        type="hidden"
                        name="userId"
                        value={member.user_id}
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        Remove
                      </Button>
                    </form>
                  </span>
                ) : (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                    {member.role}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Invite someone
            </h2>
            <form action={createInvite} className="flex flex-wrap gap-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Input
                name="email"
                type="email"
                required
                placeholder="colleague@nhs.net"
                className="max-w-xs"
              />
              <select
                name="role"
                defaultValue="editor"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                aria-label="Role"
              >
                <option value="editor">Editor — can edit pages</option>
                <option value="viewer">Viewer — read only</option>
              </select>
              <Button type="submit">Send invitation</Button>
            </form>
            <p className="text-xs text-muted-foreground">
              {emailConfigured
                ? "The invitation is emailed and expires in 7 days. It only works for the invited address."
                : "Email sending isn't configured yet — copy the invitation link below and send it yourself. It expires in 7 days and only works for the invited address."}
            </p>

            {(invites ?? []).length > 0 && (
              <ul className="space-y-2">
                {(invites ?? []).map((invite) => (
                  <li
                    key={invite.id}
                    className="space-y-1 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {invite.email}
                        <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs capitalize">
                          {invite.role}
                        </span>
                      </span>
                      <form action={revokeInvite}>
                        <input
                          type="hidden"
                          name="inviteId"
                          value={invite.id}
                        />
                        <input
                          type="hidden"
                          name="workspaceId"
                          value={workspace.id}
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          Revoke
                        </Button>
                      </form>
                    </div>
                    <Input
                      readOnly
                      value={`${origin}/invite/${invite.token}`}
                      className="h-8 text-xs"
                      aria-label="Invitation link"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
