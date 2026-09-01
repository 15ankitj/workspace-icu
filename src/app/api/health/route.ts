import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Deployment health: confirms the Supabase env vars are configured without
 * revealing values (the URL host is already public — it ships in client JS).
 */
export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKeyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).host;
    } catch {
      host = "invalid-url";
    }
  }

  return NextResponse.json({
    ok: Boolean(url) && anonKeyPresent,
    supabase_url_present: Boolean(url),
    supabase_anon_key_present: anonKeyPresent,
    supabase_host: host,
  });
}
