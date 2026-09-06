import { NextResponse, type NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { createClient } from "@/lib/supabase/server";
import { cursorColourFor, pageIdFromRoomId } from "@/lib/collab";
import { syncedBlockIdFromRoomId } from "@/lib/synced";

export const dynamic = "force-dynamic";

/**
 * Room-token endpoint (brief §8): before Liveblocks admits a user to a
 * room, verify access through RLS and issue a token scoped to read or
 * read-write. Rooms are `page:{page_id}` (the page's document) and
 * `synced:{id}` (a synced block's document, governed by its source
 * page — Appendix A §1.3 rule 3). The Liveblocks secret lives only in
 * the platform's environment settings.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Collaboration is not configured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let roomId: string | null = null;
  try {
    const body = (await request.json()) as { room?: unknown };
    roomId = typeof body.room === "string" ? body.room : null;
  } catch {
    roomId = null;
  }
  if (!roomId) {
    return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  }

  const pageId = pageIdFromRoomId(roomId);
  const syncedId = syncedBlockIdFromRoomId(roomId);
  if (!pageId && !syncedId) {
    return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  }

  let canEdit = false;
  if (pageId) {
    // Visible at all? (RLS: workspace member, and not someone else's
    // private page.) Then: editable?
    const [{ data: page }, { data: editable }] = await Promise.all([
      supabase
        .from("pages")
        .select("id, deleted_at")
        .eq("id", pageId)
        .maybeSingle(),
      supabase.rpc("can_edit_page", { p_page_id: pageId }),
    ]);
    if (!page || page.deleted_at) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    canEdit = editable === true;
  } else if (syncedId) {
    // The row is only visible when the source page is; `can_edit` folds
    // in the source page's editability, trash state and tombstones.
    const { data } = await supabase.rpc("load_synced_block", {
      p_id: syncedId,
    });
    const view = data as { can_edit?: boolean } | null;
    if (!view) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    canEdit = view.can_edit === true;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: profile?.display_name ?? "Someone",
      color: cursorColourFor(user.id),
    },
  });
  session.allow(roomId, canEdit ? session.FULL_ACCESS : session.READ_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}
