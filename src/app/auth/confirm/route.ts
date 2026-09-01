import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes a magic-link sign-in. Handles both link styles Supabase can
 * land here with:
 *  - `?code=` — the default email template's verify URL finishes with a
 *    PKCE code redirect (must be opened in the browser that requested it);
 *  - `?token_hash=&type=` — used when the email template is customised to
 *    link straight to this route.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(safeNext);
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(safeNext);
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  // Supabase can also report failures (expired/used links) as query params.
  const description =
    searchParams.get("error_description") ?? "Sign-in link invalid or expired";
  redirect(`/sign-in?error=${encodeURIComponent(description)}`);
}
