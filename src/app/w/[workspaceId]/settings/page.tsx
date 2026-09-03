import { headers } from "next/headers";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  PageShell,
  PageHeading,
  SectionHeading,
} from "@/components/ui/page-shell";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteAccountForm } from "./delete-account-form";

export const dynamic = "force-dynamic";

async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const rowClass =
  "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm";

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
    <PageShell>
      <PageHeading title="Workspace settings">{workspace.name}</PageHeading>

      <section className="space-y-3">
        <SectionHeading>Name</SectionHeading>
        {isOwner ? (
          <form action={renameWorkspace} className="flex flex-wrap gap-2">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <Label htmlFor="workspace-name" className="sr-only">
              Workspace name
            </Label>
            <Input
              id="workspace-name"
              name="name"
              defaultValue={workspace.name}
              required
              className="max-w-sm"
            />
            <SubmitButton variant="secondary" pendingLabel="Renaming…">
              Rename
            </SubmitButton>
          </form>
        ) : (
          <p className="text-sm">{workspace.name}</p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Export</SectionHeading>
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
        <SectionHeading>Members</SectionHeading>
        <ul className="space-y-2">
          {(members ?? []).map((member) => {
            const manageable =
              isOwner && member.role !== "owner" && member.user_id !== user.id;
            const name = member.users?.display_name ?? "Unknown";
            return (
              <li key={member.user_id} className={rowClass}>
                <span className="min-w-0">
                  {name}
                  <span className="ml-2 text-muted-foreground">
                    {member.users?.email}
                  </span>
                </span>
                {manageable ? (
                  <span className="flex flex-wrap items-center gap-2">
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
                      <NativeSelect
                        name="role"
                        defaultValue={member.role}
                        aria-label={`Role for ${name}`}
                        className="[&>select]:h-8"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </NativeSelect>
                      <SubmitButton
                        size="sm"
                        variant="secondary"
                        pendingLabel="Updating…"
                      >
                        Update
                      </SubmitButton>
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
                      <ConfirmButton
                        size="sm"
                        title={`Remove ${name} from this workspace?`}
                        description="They lose access immediately. Pages they wrote stay in the workspace."
                        confirmLabel="Remove member"
                      >
                        Remove
                      </ConfirmButton>
                    </form>
                  </span>
                ) : (
                  <Badge variant="muted" className="capitalize">
                    {member.role}
                  </Badge>
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
            <SectionHeading>Invite someone</SectionHeading>
            <form action={createInvite} className="flex flex-wrap gap-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Label htmlFor="invite-email" className="sr-only">
                Email address
              </Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="colleague@nhs.net"
                className="max-w-xs"
              />
              <NativeSelect
                name="role"
                defaultValue="editor"
                aria-label="Role for the invited person"
              >
                <option value="editor">Editor — can edit pages</option>
                <option value="viewer">Viewer — read only</option>
              </NativeSelect>
              <SubmitButton pendingLabel="Sending…">
                Send invitation
              </SubmitButton>
            </form>
            <p className="text-sm text-muted-foreground">
              {emailConfigured
                ? "The invitation is emailed and expires in 7 days. It only works for the invited address."
                : "Email sending isn't configured yet — copy the invitation link below and send it yourself. It expires in 7 days and only works for the invited address."}
            </p>

            {(invites ?? []).length > 0 && (
              <ul className="space-y-2">
                {(invites ?? []).map((invite) => {
                  const link = `${origin}/invite/${invite.token}`;
                  return (
                    <li
                      key={invite.id}
                      className="space-y-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {invite.email}
                          <Badge variant="muted" className="capitalize">
                            {invite.role}
                          </Badge>
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
                          <ConfirmButton
                            size="sm"
                            title={`Revoke the invitation for ${invite.email}?`}
                            description="The link stops working immediately. You can send a new one."
                            confirmLabel="Revoke invitation"
                          >
                            Revoke
                          </ConfirmButton>
                        </form>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          readOnly
                          value={link}
                          className="min-w-0 flex-1 text-xs"
                          aria-label={`Invitation link for ${invite.email}`}
                        />
                        <CopyButton value={link} size="default" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Your account</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Deleting your account removes your personal workspace and every
          workspace where you are the only member, including their files.
          Anything you wrote in workspaces you share with others stays with that
          workspace and is reassigned to its owner. Export first if you want a
          copy. This cannot be undone.
        </p>
        <DeleteAccountForm />
        <p className="text-sm text-muted-foreground">
          See the{" "}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>{" "}
          for what we hold and for how long.
        </p>
      </section>
    </PageShell>
  );
}
