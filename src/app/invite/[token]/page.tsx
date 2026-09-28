import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/app/actions/invites";
import { inviteFailureCopy } from "@/lib/invites";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export const dynamic = "force-dynamic";

/**
 * Invitation landing: the proxy already required sign-in (with `next`
 * pointing back here), so accepting is immediate and the person lands in
 * the workspace. Rendering this page again with the same link (a second
 * navigation after the sign-in) accepts again, which `accept_invite`
 * treats as the same success. Each failure gets its own explanation; only
 * the wrong-address case can be fixed by signing out, so only it offers
 * that. The way onward is kept apart from the error, so it never reads as
 * if it were granting access.
 */
export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;

  const result = await acceptInvite(token);
  if (result.ok) redirect(`/w/${result.workspaceId}`);

  const copy = inviteFailureCopy(result.reason, result.message);

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center p-6"
    >
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Invitation not accepted
        </h1>
        <Notice variant="destructive" title={copy.title}>
          <p>{copy.body}</p>
        </Notice>
        <div className="space-y-3 border-t pt-5">
          <p className="text-sm text-muted-foreground">
            Nothing about your account has changed.{" "}
            {copy.showSignOut
              ? "Sign out to switch to the invited address, or carry on to the workspaces you already belong to."
              : "Carry on to the workspaces you already belong to."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href="/">Go to my workspaces</Link>
            </Button>
            {copy.showSignOut && (
              <form action="/auth/sign-out" method="post">
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
