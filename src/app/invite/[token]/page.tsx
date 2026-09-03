import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export const dynamic = "force-dynamic";

/**
 * Invitation landing: the proxy already required sign-in (with `next`
 * pointing back here), so accepting is immediate. Errors are shown with
 * the usual reasons — wrong address, expired, already used.
 */
export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;

  let workspaceId: string | null = null;
  let message: string | null = null;
  try {
    workspaceId = await acceptInvite(token);
  } catch (error) {
    message = error instanceof Error ? error.message : "Could not accept";
  }
  if (workspaceId) redirect(`/w/${workspaceId}`);

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center p-6"
    >
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Invitation not accepted
        </h1>
        <Notice variant="destructive" title={message ?? "Could not accept"}>
          <p>
            Invitations only work for the email address they were sent to. If
            you signed in with a different address, sign out and sign in with
            the invited one, then open the link again.
          </p>
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/">Go to your workspace</Link>
          </Button>
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
