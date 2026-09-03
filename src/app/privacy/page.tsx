import Link from "next/link";
import {
  PageShell,
  PageHeading,
  SectionHeading,
} from "@/components/ui/page-shell";

export const metadata = { title: "Privacy — WorkspaceICU" };

const listClass = "list-disc space-y-1 pl-5 text-sm";

/**
 * The privacy notice. Mirrors docs/compliance/privacy-notice.md; the
 * bracketed items are filled in by the controller before launch. Styled by
 * hand like the guidance page: Tailwind's preflight strips heading and
 * list styling, and the typography plugin is not part of this project.
 */
export default function PrivacyPage() {
  return (
    <PageShell className="gap-6">
      <PageHeading title="Privacy notice">Last updated: [date].</PageHeading>
      <p className="text-sm">
        <strong>Who we are.</strong> WorkspaceICU is operated by [company name],
        registered in England and Wales (company number [number]), ICO
        registration [number]. Contact: [privacy email].
      </p>
      <p className="text-sm">
        <strong>What WorkspaceICU is.</strong> A collaborative workspace for
        intensive care doctors to write, organise and share their own documents
        — for learning, supervision and portfolio preparation. It is not a
        clinical system. Our acceptable use policy prohibits
        patient-identifiable information, and we provide reminders and an
        advisory scan to help you keep it out. See the{" "}
        <Link href="/guidance/anonymisation" className="underline">
          anonymisation guidance
        </Link>
        .
      </p>

      <section className="space-y-2">
        <SectionHeading>What we collect</SectionHeading>
        <ul className={listClass}>
          <li>
            Your email address, display name and, if you sign in with Google,
            your Google profile name and picture.
          </li>
          <li>
            The content you create: pages, comments and files, and who you share
            them with.
          </li>
          <li>
            Sign-in times, invitations you send or accept, and an audit trail of
            actions such as uploads, deletions and membership changes.
          </li>
          <li>
            Technical error reports when something goes wrong. These never
            include the content of your pages.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <SectionHeading>Why</SectionHeading>
        <p className="text-sm">
          To provide the service you signed up for; to keep it secure and to
          investigate misuse; to send you sign-in links and invitations. We do
          not profile you, advertise to you, or sell your data.
        </p>
      </section>

      <section className="space-y-2">
        <SectionHeading>Who processes it for us</SectionHeading>
        <p className="text-sm">
          Supabase (database, sign-in and file storage, in London), Vercel
          (hosting, in London for our application code), Liveblocks (real-time
          collaboration while you edit, currently hosted outside the UK under
          standard contractual safeguards), Resend (sign-in emails and
          invitations), Sentry (error monitoring, without content) and Google
          (only if you sign in with Google).
        </p>
      </section>

      <section className="space-y-2">
        <SectionHeading>How long we keep it</SectionHeading>
        <p className="text-sm">
          Your content stays until you delete it; deleted pages sit in the trash
          for 30 days and are then removed permanently along with their files.
          Page edit history is kept for 90 days. Audit records are kept for 12
          months.
        </p>
      </section>

      <section className="space-y-2">
        <SectionHeading>Your rights</SectionHeading>
        <p className="text-sm">
          You can export everything you can see in a workspace at any time. You
          can delete your account yourself from workspace settings: your
          personal workspace and anything in workspaces where you are the only
          member are erased; content you wrote in shared workspaces stays with
          that workspace. You also have the right to ask us for access,
          correction, erasure or restriction, and to complain to the Information
          Commissioner&apos;s Office (ico.org.uk).
        </p>
        <p className="text-sm">
          <strong>
            If you believe patient-identifiable information has been added
          </strong>
          , use <em>Report content</em> on the page or email [privacy email];
          the workspace owner can remove it immediately.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/sign-in" className="underline">
          Back to sign-in
        </Link>
      </p>
    </PageShell>
  );
}
