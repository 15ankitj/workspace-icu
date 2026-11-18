import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  leaveWorkspace,
  renameWorkspace,
  restoreWorkspace,
  transferOwnership,
} from "@/app/actions/workspaces";
import {
  createInvite,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "@/app/actions/invites";
import { isEmailConfigured } from "@/lib/email";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
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
import { DeleteWorkspaceForm } from "./delete-workspace-form";
import { PasskeysBlock } from "./passkeys-block";
import { flags } from "@/lib/flags";
import { setEmailDigest } from "@/app/actions/suggestions";

export const dynamic = "force-dynamic";

async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const TRASH_DAYS = 30;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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
    { data: members, error: membersError },
    { data: membership },
    { data: invites },
    { data: me },
    { data: deletedWorkspaces },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, is_personal")
      .eq("id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select(
        "user_id, role, joined_at, users!workspace_members_user_id_fkey(display_name, email)",
      )
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
    supabase
      .from("users")
      .select("email_digest")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("list_deleted_workspaces"),
  ]);
  const emailDigest = me?.email_digest ?? true;
  if (!workspace || !membership) notFound();
  if (membersError) {
    console.error(
      `Workspace members unavailable: ${membersError.code} ${membersError.message}`,
    );
  }

  const isOwner = membership.role === "owner";
  const otherMembers = (members ?? []).filter((m) => m.user_id !== user.id);
  // If the list failed to load, do not offer what the database may refuse.
  const alone = !membersError && otherMembers.length === 0;
  const origin = isOwner ? await appOrigin() : "";
  const emailConfigured = isEmailConfigured();

  return (
    <PageShell>
      <PageHeading title="Workspace settings">{workspace.name}</PageHeading>

      <section className="space-y-3">
        <SectionHeading>Name</SectionHeading>
        {isOwner ? (
          <ActionForm action={renameWorkspace} className="flex flex-wrap gap-2">
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
          </ActionForm>
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
          content with you at any time. Pages export in their clean state; if
          suggestions are still waiting anywhere, the zip says which pages.
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
        {membersError && (
          <p className="text-sm text-muted-foreground">
            The member list could not be loaded.
          </p>
        )}
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
                    <ActionForm
                      action={updateMemberRole}
                      className="flex gap-1"
                    >
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
                    </ActionForm>
                    <ActionForm action={removeMember}>
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
                    </ActionForm>
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
            <ActionForm action={createInvite} className="flex flex-wrap gap-2">
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
            </ActionForm>
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
                        <ActionForm action={revokeInvite}>
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
                        </ActionForm>
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

      <section className="space-y-4">
        <SectionHeading>Danger zone</SectionHeading>
        {isOwner ? (
          <>
            {!workspace.is_personal && otherMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Transfer ownership</span>
                  <span className="block text-muted-foreground">
                    The new owner manages members and can delete the workspace.
                    You stay on as an editor.
                  </span>
                </p>
                <ActionForm
                  action={transferOwnership}
                  className="flex flex-wrap gap-2"
                >
                  <input
                    type="hidden"
                    name="workspaceId"
                    value={workspace.id}
                  />
                  <NativeSelect
                    name="userId"
                    required
                    defaultValue=""
                    aria-label="New owner"
                  >
                    <option value="" disabled>
                      Choose a member…
                    </option>
                    {otherMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.users?.display_name ?? "Unknown"}
                        {member.users?.email ? ` (${member.users.email})` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                  <ConfirmButton
                    title="Transfer ownership of this workspace?"
                    description="The person you chose becomes the owner straight away and you become an editor. Only they can hand it back."
                    confirmLabel="Transfer ownership"
                  >
                    Transfer ownership
                  </ConfirmButton>
                </ActionForm>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Delete this workspace</span>
                <span className="block text-muted-foreground">
                  {workspace.is_personal
                    ? "Your personal workspace cannot be deleted on its own. It is removed when you delete your account."
                    : alone
                      ? `Every page and file in it is deleted. You can restore the workspace from here for ${TRASH_DAYS} days; after that it is removed permanently. Export first if you want a copy.`
                      : "A workspace that still has other members cannot be deleted. Remove the other members first, or transfer ownership and leave."}
                </span>
              </p>
              {!workspace.is_personal && alone && (
                <DeleteWorkspaceForm
                  workspaceId={workspace.id}
                  workspaceName={workspace.name}
                />
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Leave this workspace</span>
              <span className="block text-muted-foreground">
                You lose access straight away. Pages and files you added stay in
                the workspace and pass to its owner, including pages you marked
                private — delete anything you do not want to hand over first.
              </span>
            </p>
            <ActionForm action={leaveWorkspace}>
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <ConfirmButton
                title={`Leave ${workspace.name}?`}
                description="You lose access straight away, and what you added passes to the workspace owner. To come back you will need a new invitation."
                confirmLabel="Leave workspace"
              >
                Leave workspace
              </ConfirmButton>
            </ActionForm>
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Your account</SectionHeading>
        <ActionForm
          action={setEmailDigest}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input
            type="hidden"
            name="enabled"
            value={emailDigest ? "false" : "true"}
          />
          <p className="text-sm">
            <span className="font-medium">Daily email digest</span>
            <span className="block text-muted-foreground">
              One email a day, only when suggestions on your pages were made,
              resolved or replied to. Currently{" "}
              <strong>{emailDigest ? "on" : "off"}</strong>.
            </span>
          </p>
          <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
            {emailDigest ? "Switch off" : "Switch on"}
          </SubmitButton>
        </ActionForm>
        <PasskeysBlock enabled={flags.passkeys} />
        {(deletedWorkspaces ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Deleted workspaces</span>
              <span className="block text-muted-foreground">
                Workspaces you deleted can be restored for {TRASH_DAYS} days.
              </span>
            </p>
            <ul className="space-y-2">
              {(deletedWorkspaces ?? []).map((deleted) => (
                <li key={deleted.id} className={rowClass}>
                  <span className="min-w-0">
                    {deleted.name}
                    <span className="ml-2 text-muted-foreground">
                      Removed permanently on{" "}
                      {dateFormat.format(
                        new Date(
                          new Date(deleted.deleted_at).getTime() +
                            TRASH_DAYS * 86_400_000,
                        ),
                      )}
                    </span>
                  </span>
                  <ActionForm action={restoreWorkspace}>
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={deleted.id}
                    />
                    <SubmitButton
                      size="sm"
                      variant="secondary"
                      pendingLabel="Restoring…"
                    >
                      Restore
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        )}
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
