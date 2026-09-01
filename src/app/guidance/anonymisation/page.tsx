export const metadata = { title: "Anonymisation guidance — WorkspaceICU" };

/**
 * Linked from the upload reminder (brief §9 nudge 2). Plain-English,
 * static guidance; no patient examples, only category descriptions.
 */
export default function AnonymisationGuidance() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 md:p-12">
      <h1 className="text-2xl font-semibold">
        Anonymising documents before upload
      </h1>
      <p className="text-sm text-muted-foreground">
        WorkspaceICU is not a clinical record. Before uploading anything, remove
        everything that could identify a patient — on its own or in combination.
      </p>

      <section className="space-y-2">
        <h2 className="font-medium">Remove or replace</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
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
        <h2 className="font-medium">How to anonymise</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
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

      <p className="text-xs text-muted-foreground">
        The upload scan is advisory only and cannot catch everything — the
        responsibility for anonymisation stays with you, as it would in any
        portfolio or teaching context. If in doubt, ask your Caldicott Guardian
        or information-governance team.
      </p>
    </main>
  );
}
