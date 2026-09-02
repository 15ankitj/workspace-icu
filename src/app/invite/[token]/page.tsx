import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/app/actions/invites";

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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold">Invitation not accepted</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          Invitations only work for the email address they were sent to. If you
          signed in with a different address, sign out and sign in with the
          invited one, then open the link again.
        </p>
        <Link href="/" className="text-sm underline">
          Go to your workspace
        </Link>
      </div>
    </main>
  );
}
