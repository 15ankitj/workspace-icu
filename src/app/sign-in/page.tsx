"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUP_STATEMENT, AUP_VERSION } from "@/lib/aup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/**
 * Sign-in: a magic link and a 6-digit code arrive in the same email
 * (the Supabase templates include both `{{ .ConfirmationURL }}` and
 * `{{ .Token }}` — see docs/runbook.md). The link completes at
 * /auth/confirm; the code is verified here, on the page that asked for
 * it, which is what works when the email is opened on another device or
 * the link is rewritten by a mail filter.
 */
function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") ? requestedNext : "/";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [aupAccepted, setAupAccepted] = useState(false);
  const [phase, setPhase] = useState<"request" | "sent">("request");
  const [busy, setBusy] = useState<"sending" | "verifying" | null>(null);
  const [error, setError] = useState<string | null>(authError);

  const supabase = createClient();
  const redirectBase =
    typeof window !== "undefined" ? window.location.origin : "";

  async function requestCode(): Promise<boolean> {
    if (!aupAccepted) {
      setError("Please confirm the acceptable-use statement first.");
      return false;
    }
    setBusy("sending");
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectBase}/auth/confirm?next=${encodeURIComponent(next)}`,
        data: { accepted_aup_version: AUP_VERSION },
      },
    });
    setBusy(null);
    if (sendError) {
      setError(sendError.message);
      return false;
    }
    return true;
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (await requestCode()) setPhase("sent");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const token = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(token)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy("verifying");
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (verifyError) {
      setBusy(null);
      setError(verifyError.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    if (!aupAccepted) {
      setError("Please confirm the acceptable-use statement first.");
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${redirectBase}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">WorkspaceICU</h1>
          <p className="text-sm text-muted-foreground">
            A collaborative workspace for intensive care doctors
          </p>
        </div>

        {phase === "sent" ? (
          <div className="space-y-4">
            <p className="rounded-md border p-4 text-center text-sm">
              Check your email — we&apos;ve sent a sign-in link and a code to{" "}
              <strong>{email}</strong>.
            </p>
            <form onSubmit={verifyCode} className="space-y-3">
              <label
                htmlFor="otp-code"
                className="block text-sm text-muted-foreground"
              >
                Enter the 6-digit code from the email
              </label>
              <Input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                required
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-[0.3em]"
              />
              <Button type="submit" className="w-full" disabled={busy !== null}>
                {busy === "verifying" ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Or open the link in the email — either works.
            </p>
            <div className="flex justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setPhase("request");
                  setCode("");
                  setError(null);
                }}
              >
                Use a different email
              </button>
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
                disabled={busy !== null}
                onClick={() => {
                  setCode("");
                  void requestCode();
                }}
              >
                {busy === "sending" ? "Sending…" : "Send again"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="space-y-3">
              <Input
                type="email"
                required
                placeholder="you@nhs.net or any email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
              />
              <Button type="submit" className="w-full" disabled={busy !== null}>
                {busy === "sending" ? "Sending…" : "Continue with email"}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
            >
              Continue with Google
            </Button>

            <label className="flex items-start gap-2 rounded-md border p-3 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={aupAccepted}
                onChange={(e) => setAupAccepted(e.target.checked)}
                aria-label="Accept the acceptable-use statement"
              />
              <span>{AUP_STATEMENT}</span>
            </label>
          </>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
