import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/safe-next";
import { Wordmark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Continue to WorkspaceICU",
  // The URL carries a one-time sign-in token: never index it.
  robots: "noindex",
};

/**
 * The page a sign-in email link opens (via GET /auth/confirm). It does
 * nothing with the token except put it in a form; the button's POST to
 * /auth/confirm is what verifies it. That single click is what keeps mail
 * security scanners, which fetch every link in an email as it arrives,
 * from consuming the one-time token before the user does — see the
 * comment in src/app/auth/confirm/route.ts. Plain HTML: it must work with
 * JavaScript off and in a mail client's built-in browser.
 */
export default async function ContinuePage({
  searchParams,
}: PageProps<"/auth/continue">) {
  const params = await searchParams;
  const tokenHash = single(params.token_hash);
  const type = single(params.type);
  const next = safeNextPath(single(params.next));

  if (!tokenHash || !type) {
    redirect("/sign-in?error=Sign-in%20link%20invalid%20or%20expired");
  }

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center p-6"
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <h1 className="flex justify-center">
            <Wordmark className="h-9" />
          </h1>
          <p className="text-sm text-muted-foreground">
            A collaborative workspace for intensive care doctors
          </p>
        </div>

        <form method="post" action="/auth/confirm" className="space-y-3">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" className="w-full">
            Continue to WorkspaceICU
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            One more click — this stops email security scanners from using your
            sign-in link before you do.
          </p>
        </form>

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

function single(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}
