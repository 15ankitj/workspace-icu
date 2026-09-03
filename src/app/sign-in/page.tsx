"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUP_STATEMENT, AUP_VERSION } from "@/lib/aup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Separator } from "@/components/ui/separator";

/**
 * Sign-in: a magic link and a one-time code arrive in the same email
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
  const emailId = useId();
  const aupId = useId();

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
    // Supabase's code length is a project setting (6–10 digits).
    if (!/^\d{6,10}$/.test(token)) {
      setError("Enter the code from the email (digits only).");
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
    <main
      id="main"
      className="flex min-h-screen items-center justify-center p-6"
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            WorkspaceICU
          </h1>
          <p className="text-sm text-muted-foreground">
            A collaborative workspace for intensive care doctors
          </p>
        </div>

        {phase === "sent" ? (
          <div className="space-y-4">
            <Notice title={`Check your email at ${email}`}>
              <p>
                We&apos;ve sent a sign-in link and a code. Either one signs you
                in.
              </p>
            </Notice>
            <form onSubmit={verifyCode} className="space-y-3">
              <Field label="Enter the code from the email" htmlFor="otp-code">
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]*"
                  maxLength={12}
                  required
                  autoFocus
                  placeholder="12345678"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-center text-lg tracking-[0.3em]"
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy !== null}>
                {busy === "verifying" ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="flex justify-between">
              <Button
                type="button"
                variant="link"
                size="xs"
                className="px-0 text-muted-foreground"
                onClick={() => {
                  setPhase("request");
                  setCode("");
                  setError(null);
                }}
              >
                Use a different email
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                className="px-0 text-muted-foreground"
                disabled={busy !== null}
                onClick={() => {
                  setCode("");
                  void requestCode();
                }}
              >
                {busy === "sending" ? "Sending…" : "Send again"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Notice variant="warning" title="Acceptable use">
              <label htmlFor={aupId} className="flex items-start gap-2">
                <input
                  id={aupId}
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={aupAccepted}
                  onChange={(e) => {
                    setAupAccepted(e.target.checked);
                    if (e.target.checked) setError(null);
                  }}
                />
                <span>{AUP_STATEMENT}</span>
              </label>
            </Notice>

            <form onSubmit={sendMagicLink} className="space-y-3">
              <Field label="Email address" htmlFor={emailId}>
                <Input
                  id={emailId}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@nhs.net or any email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
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
          </>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Not a clinical record.{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy notice
          </Link>
        </p>
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
