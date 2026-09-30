"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  ok,
  runAction,
  sentence,
  type ActionResult,
  type FormState,
} from "@/lib/action-result";
import { inviteEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import type { WorkspaceRole } from "@/lib/database.types";
import { inviteFailureReason, type InviteFailureReason } from "@/lib/invites";

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
export async function createInvite(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") ?? "editor") as WorkspaceRole;
    if (!workspaceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Enter a valid email address");
    }
    if (role !== "editor" && role !== "viewer") {
      return fail("Invalid role");
    }

    const { supabase, user } = await requireUser();

    // Brief §12: rate-limit invitations (20 per hour per user; the limit
    // and window live in the database function).
    const { data: allowed } = await supabase.rpc("consume_rate_limit", {
      p_action: "invite_create",
    });
    if (allowed === false) {
      return fail(
        "Too many invitations in the last hour — try again later",
        "rate_limited",
      );
    }

    const [{ data: workspace }, { data: inviter }] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
      supabase.from("users").select("display_name").eq("id", user.id).single(),
    ]);
    if (!workspace) return fail("Workspace not found");

    const { data: invite, error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: workspaceId, email, role, invited_by: user.id })
      .select("id, token")
      .single();
    if (error) {
      return error.code === "23505"
        ? fail("That address already has a pending invitation", "conflict")
        : fromSupabaseError(error);
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
    return ok();
  });
}

export async function revokeInvite(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const inviteId = String(formData.get("inviteId") ?? "");
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("workspace_invites")
      .delete()
      .eq("id", inviteId);
    if (error) return fromSupabaseError(error);
    await audit(
      supabase,
      user.id,
      workspaceId,
      "invite_revoked",
      "workspace_invite",
      inviteId,
    );
    revalidatePath(`/w/${workspaceId}/settings`);
    return ok();
  });
}

/** An ActionResult whose failure also names the reason the invite page
 *  explains; `message` is the raw database text, `error` the sentence. */
export type AcceptInviteResult =
  | { ok: true; workspaceId: string }
  | {
      ok: false;
      reason: InviteFailureReason;
      message: string;
      error: string;
    };

/**
 * Invitee accepts while signed in with the invited address. Accepting the
 * same invitation again (the page can render twice after a sign-in) is
 * not a failure: `accept_invite` (migration 0028) returns the workspace
 * again for the person who accepted it. Failures come back as a reason
 * the page can explain, never as a thrown error.
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  const { supabase } = await requireUser();
  const { data: workspaceId, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error) {
    return {
      ok: false,
      reason: inviteFailureReason(error),
      message: error.message,
      error: sentence(error.message),
    };
  }
  if (!workspaceId) {
    const message = "Invitation could not be accepted";
    return { ok: false, reason: "unknown", message, error: sentence(message) };
  }
  return { ok: true, workspaceId };
}

export async function updateMemberRole(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "") as WorkspaceRole;
    if (!["editor", "viewer"].includes(role)) return fail("Invalid role");

    const { supabase, user } = await requireUser();
    if (userId === user.id) return fail("You cannot change your own role");

    const { error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .neq("role", "owner");
    if (error) return fromSupabaseError(error);
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
    return ok();
  });
}

export async function removeMember(
  _state: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const userId = String(formData.get("userId") ?? "");
    const { supabase, user } = await requireUser();
    if (userId === user.id) return fail("Owners cannot remove themselves");

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .neq("role", "owner");
    if (error) return fromSupabaseError(error);
    // member_removed is recorded by the membership audit trigger.
    revalidatePath(`/w/${workspaceId}/settings`);
    return ok();
  });
}
