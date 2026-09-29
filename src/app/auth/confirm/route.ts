import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Completes a magic-link sign-in. Handles both link styles Supabase can
 * land here with:
 *  - `?token_hash=&type=` — our email template links straight to this
 *    route (docs/email/sign-in-template.html). A GET never verifies the
 *    token: it sends the browser to /auth/continue, a page with one
 *    button, and only that button's form POST (below) calls `verifyOtp`.
 *    Mail security scanners (Microsoft Defender Safe Links on NHS
 *    mailboxes) fetch every link in an email as it arrives; when the GET
 *    verified, the scanner consumed the one-time token seconds after the
 *    email was sent — the user's click and the code from the same email
 *    (they share one token) both failed, and the scanner briefly held a
 *    signed-in session. Scanners follow links; they do not submit forms.
 *  - `?code=` — legacy Supabase-hosted links (the default template's
 *    `{{ .ConfirmationURL }}`) finish with a PKCE code. That branch stays
 *    on GET: exchanging the code needs the PKCE verifier, which lives in
 *    the cookies of the browser that asked to sign in, so a scanner's
 *    fetch of the link cannot complete it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = safeNextPath(next);

  if (token_hash && type) {
    const url = new URL("/auth/continue", request.url);
    url.searchParams.set("token_hash", token_hash);
    url.searchParams.set("type", type);
    url.searchParams.set("next", safeNext);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
    return NextResponse.redirect(signInError(request, error.message));
  }

  // Supabase can also report failures (expired/used links) as query params.
  const description =
    searchParams.get("error_description") ?? "Sign-in link invalid or expired";
  return NextResponse.redirect(signInError(request, description));
}

/**
 * The only place a `token_hash` is verified: the submit of the form on
 * /auth/continue. The redirects are 303 so the browser follows them with
 * a GET (a 307 would re-POST the form to the destination).
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.redirect(
      signInError(request, "Sign-in link invalid or expired"),
      303,
    );
  }

  const token_hash = formField(form, "token_hash");
  const type = formField(form, "type") as EmailOtpType | null;
  const safeNext = safeNextPath(formField(form, "next"));

  if (!token_hash || !type) {
    return NextResponse.redirect(
      signInError(request, "Sign-in link invalid or expired"),
      303,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (!error) return NextResponse.redirect(new URL(safeNext, request.url), 303);
  return NextResponse.redirect(signInError(request, error.message), 303);
}

function formField(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" && value !== "" ? value : null;
}

function signInError(request: NextRequest, message: string): URL {
  return new URL(`/sign-in?error=${encodeURIComponent(message)}`, request.url);
}
