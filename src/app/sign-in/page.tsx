"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUP_STATEMENT, AUP_VERSION } from "@/lib/aup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [aupAccepted, setAupAccepted] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >(authError ? { kind: "error", message: authError } : { kind: "idle" });

  const supabase = createClient();
  const redirectBase =
    typeof window !== "undefined" ? window.location.origin : "";

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!aupAccepted) {
      setStatus({
        kind: "error",
        message: "Please confirm the acceptable-use statement first.",
      });
      return;
    }
    setStatus({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectBase}/auth/confirm?next=${encodeURIComponent(next)}`,
        data: { accepted_aup_version: AUP_VERSION },
      },
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
    } else {
      setStatus({ kind: "sent" });
    }
  }

  async function signInWithGoogle() {
    if (!aupAccepted) {
      setStatus({
        kind: "error",
        message: "Please confirm the acceptable-use statement first.",
      });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${redirectBase}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setStatus({ kind: "error", message: error.message });
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

        {status.kind === "sent" ? (
          <p className="rounded-md border p-4 text-center text-sm">
            Check your email — we&apos;ve sent you a sign-in link.
          </p>
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
              <Button
                type="submit"
                className="w-full"
                disabled={status.kind === "sending"}
              >
                {status.kind === "sending"
                  ? "Sending link…"
                  : "Continue with email"}
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

            {status.kind === "error" && (
              <p className="text-sm text-destructive" role="alert">
                {status.message}
              </p>
            )}
          </>
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
