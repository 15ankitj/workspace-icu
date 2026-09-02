import { notFound, redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Stable file URL: blocks reference /api/files/{id}; this authenticates
 * via RLS (the row is only visible when the page is) and redirects to a
 * short-lived signed Storage URL. No public buckets, ever (brief §9).
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/files/[fileId]">,
) {
  const { fileId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: file } = await supabase
    .from("files")
    .select("storage_path, deleted_at")
    .eq("id", fileId)
    .maybeSingle();
  if (!file || file.deleted_at) notFound();

  const { data: signed, error } = await supabase.storage
    .from("files")
    .createSignedUrl(file.storage_path, 60);
  if (error || !signed) notFound();

  redirect(signed.signedUrl);
}
