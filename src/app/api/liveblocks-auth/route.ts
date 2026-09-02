import { NextResponse, type NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { createClient } from "@/lib/supabase/server";
import { cursorColourFor, pageIdFromRoomId } from "@/lib/collab";

export const dynamic = "force-dynamic";

/**
 * Room-token endpoint (brief §8): before Liveblocks admits a user to
 * `page:{page_id}`, verify workspace membership and page privacy through
 * RLS and issue a token scoped to read or read-write. The Liveblocks
 * secret lives only in the platform's environment settings.
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
  const pageId = roomId ? pageIdFromRoomId(roomId) : null;
  if (!roomId || !pageId) {
    return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  }

  // Visible at all? (RLS: workspace member, and not someone else's private
  // page.) Then: editable?
  const [{ data: page }, { data: canEdit }, { data: profile }] =
    await Promise.all([
      supabase
        .from("pages")
        .select("id, deleted_at")
        .eq("id", pageId)
        .maybeSingle(),
      supabase.rpc("can_edit_page", { p_page_id: pageId }),
      supabase
        .from("users")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
  if (!page || page.deleted_at) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: profile?.display_name ?? "Someone",
      color: cursorColourFor(user.id),
    },
  });
  session.allow(
    roomId,
    canEdit === true ? session.FULL_ACCESS : session.READ_ACCESS,
  );

  const { status, body } = await session.authorize();
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}
