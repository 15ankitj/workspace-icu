import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import {
  PageShell,
  PageHeading,
  SectionHeading,
} from "@/components/ui/page-shell";

export const metadata = { title: "Anonymisation guidance — WorkspaceICU" };

const listClass = "list-disc space-y-1 pl-5 text-sm";

/**
 * Linked from the upload reminder (brief §9 nudge 2). Plain-English,
 * static guidance; no patient examples, only category descriptions.
 */
export default function AnonymisationGuidance() {
  return (
    <PageShell className="gap-6">
      <PageHeading title="Anonymising documents before upload">
        WorkspaceICU is not a clinical record. Before uploading anything, remove
        everything that could identify a patient — on its own or in combination.
      </PageHeading>

      <section className="space-y-2">
        <SectionHeading>Remove or replace</SectionHeading>
        <ul className={listClass}>
          <li>Names and initials of patients and relatives</li>
          <li>NHS numbers, hospital numbers, and any other identifiers</li>
          <li>Dates of birth, and exact dates of admission or procedures</li>
          <li>Addresses, postcodes, phone numbers, email addresses</li>
          <li>
            Faces or identifying features in images; identifiable imaging (scans
            with visible patient details in headers)
          </li>
          <li>
            Rare-disease or circumstance details that make someone identifiable
            even without a name
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <SectionHeading>How to anonymise</SectionHeading>
        <ul className={listClass}>
          <li>
            Rewrite rather than redact where possible: “a patient in their 60s
            admitted with sepsis”, not a name behind a black box.
          </li>
          <li>
            Replace exact dates with relative time (“day 3 of admission”) or
            month/year where enough.
          </li>
          <li>
            Re-export documents after editing — cropped screenshots and PDF
            annotations can retain the original underneath.
          </li>
          <li>Check document metadata (author, track changes, comments).</li>
        </ul>
      </section>

      <Notice variant="warning" title="The upload scan is advisory only">
        <p>
          It cannot catch everything. The responsibility for anonymisation stays
          with you, as it would in any portfolio or teaching context. If in
          doubt, ask your Caldicott Guardian or information-governance team.
        </p>
      </Notice>

      <p className="text-sm text-muted-foreground">
        See also the{" "}
        <Link href="/privacy" className="underline">
          privacy notice
        </Link>
        .
      </p>
    </PageShell>
  );
}
