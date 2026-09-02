"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { inviteEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import type { WorkspaceRole } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  workspaceId: string,
  eventType: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_events").insert({
    actor_id: actorId,
    workspace_id: workspaceId,
    event_type: eventType,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

/** Owner invites an email address at editor or viewer (brief §4). */
export async function createInvite(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "editor") as WorkspaceRole;
  if (!workspaceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (role !== "editor" && role !== "viewer") {
    throw new Error("Invalid role");
  }

  const { supabase, user } = await requireUser();

  const [{ data: workspace }, { data: inviter }] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
    supabase.from("users").select("display_name").eq("id", user.id).single(),
  ]);
  if (!workspace) throw new Error("Workspace not found");

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({ workspace_id: workspaceId, email, role, invited_by: user.id })
    .select("id, token")
    .single();
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That address already has a pending invitation"
        : `Could not create invitation: ${error.message}`,
    );
  }

  await audit(
    supabase,
    user.id,
    workspaceId,
    "invite_created",
    "workspace_invite",
    invite.id,
    {
      role,
      email_domain: email.split("@")[1],
    },
  );

  if (isEmailConfigured()) {
    const acceptUrl = `${await appOrigin()}/invite/${invite.token}`;
    try {
      await sendEmail(
        inviteEmail({
          to: email,
          inviterName: inviter?.display_name ?? "A colleague",
          workspaceName: workspace.name,
          role,
          acceptUrl,
        }),
      );
    } catch (sendError) {
      // The invitation exists and its link can be copied from settings.
      console.error("Invite email failed:", sendError);
    }
  }

  revalidatePath(`/w/${workspaceId}/settings`);
}

export async function revokeInvite(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId);
  if (error) throw new Error(`Could not revoke invitation: ${error.message}`);
  await audit(
    supabase,
    user.id,
    workspaceId,
    "invite_revoked",
    "workspace_invite",
    inviteId,
  );
  revalidatePath(`/w/${workspaceId}/settings`);
}

/** Invitee accepts while signed in with the invited address. */
export async function acceptInvite(token: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data: workspaceId, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error || !workspaceId) {
    throw new Error(error?.message ?? "Invitation could not be accepted");
  }
  return workspaceId;
}

export async function updateMemberRole(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as WorkspaceRole;
  if (!["editor", "viewer"].includes(role)) throw new Error("Invalid role");

  const { supabase, user } = await requireUser();
  if (userId === user.id) throw new Error("You cannot change your own role");

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .neq("role", "owner");
  if (error) throw new Error(`Could not change role: ${error.message}`);
  await audit(
    supabase,
    user.id,
    workspaceId,
    "member_role_changed",
    "workspace_member",
    userId,
    { role },
  );
  revalidatePath(`/w/${workspaceId}/settings`);
}

export async function removeMember(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const { supabase, user } = await requireUser();
  if (userId === user.id) throw new Error("Owners cannot remove themselves");

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .neq("role", "owner");
  if (error) throw new Error(`Could not remove member: ${error.message}`);
  // member_removed is recorded by the membership audit trigger.
  revalidatePath(`/w/${workspaceId}/settings`);
}
