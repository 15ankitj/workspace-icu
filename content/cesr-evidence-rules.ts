/**
 * "Evidence rules that apply everywhere" — the September pack's
 * cross-cutting requirements page (content/source/cesr/evidence-rules.md),
 * copied verbatim; content/cesr-evidence-rules.test.ts checks every line
 * against the source. Source: GMC Specialty Specific Guidance for ICM
 * (Portfolio pathway), updated 04/02/2025. Rendered by the Evidence hub's
 * seeded child page in content/cesr-journey.ts; inline markdown emphasis
 * is rendered by `md()` in content/blocks.ts.
 */

export interface EvidenceRulesBlock {
  kind: "bullet" | "todo" | "paragraph";
  text: string;
}

export interface EvidenceRulesSection {
  heading: string;
  blocks: EvidenceRulesBlock[];
}

export const EVIDENCE_RULES: {
  /** The page's opening note. */
  intro: string;
  sections: EvidenceRulesSection[];
} = {
  intro:
    "Read this page first and revisit it before submission. Every HiLLO page in this workspace assumes these rules; they are not repeated there.",
  sections: [
    {
      heading: "The application at a glance",
      blocks: [
        {
          kind: "bullet",
          text: "The standard assessed is the **Knowledge, Skills and Experience (KSE)** of a UK specialist, framed by the **14 HiLLOs** of the ICM CCT curriculum.",
        },
        {
          kind: "bullet",
          text: "Required placements: **General ICM (minimum 2¼ years), Anaesthesia, Medicine, Neuro ICM, Cardiothoracic ICM, Paediatric ICM.** An application without evidence of these placements and experiential learning is unlikely to succeed.",
        },
        {
          kind: "bullet",
          text: "You must also declare a **Special Skills Year (SSY)** area, evidenced at a **higher capability level** than the curriculum requires for that HiLLO.",
        },
        {
          kind: "bullet",
          text: "Most applications contain **800–1,000 pages**. Quality, relevance and organisation beat volume.",
        },
        {
          kind: "bullet",
          text: "You **cannot compensate** for weak evidence in one HiLLO with extra evidence in another — this is explicit for HiLLOs 10–14.",
        },
      ],
    },
    {
      heading: "Mandatory cross-cutting items",
      blocks: [
        {
          kind: "todo",
          text: "**Three Structured Reports minimum** — one from your current Clinical Director, at least two more from colleagues practising ICM who have worked with you within the last two years",
        },
        {
          kind: "todo",
          text: "**At least 20 SLEs** overall (in addition to HiLLO 10's own SLE requirement), balanced across HiLLOs",
        },
        {
          kind: "todo",
          text: "**At least three MSFs**, from different times and placements (or contemporaneous colleague feedback if unavailable)",
        },
        {
          kind: "todo",
          text: "**At least four reflective pieces**, spread across the application, mixing clinical and non-clinical practice",
        },
        {
          kind: "todo",
          text: "**At least two referral letters/emails** (discharge summaries, coroner reports acceptable)",
        },
        {
          kind: "todo",
          text: "**Appraisals from the last three years** of clinical practice",
        },
        {
          kind: "todo",
          text: "**Sample rotas for every placement** (e.g. eight consecutive weeks for a 1:8 rota)",
        },
        {
          kind: "todo",
          text: "**Departmental/unit annual caseload statistics** for placements in the last seven years",
        },
        {
          kind: "todo",
          text: "**CV** in GMC format, matched by employment letters and job descriptions",
        },
        {
          kind: "todo",
          text: "**Examination:** FFICM, or an accepted equivalent (EDIC, DICM, FCICM with full programme); without one, a full FFICM-mapping portfolio is required and success is at FICM's discretion — EDAIC is explicitly insufficient",
        },
      ],
    },
    {
      heading: "Currency — the seven-year rule",
      blocks: [
        {
          kind: "paragraph",
          text: "Evidence older than **seven years (whole-time equivalent)** does not demonstrate current capability on its own. You need not repeat the placement; you must evidence **maintenance** (logbooks, SLEs, reflections, referrals, ongoing practice). CPD alone is insufficient to demonstrate maintenance. Each specialty HiLLO page in this workspace has a maintenance checklist.",
        },
      ],
    },
    {
      heading: "Anonymisation (GMC will return non-compliant evidence)",
      blocks: [
        {
          kind: "paragraph",
          text: "Remove from every document before upload or submission:",
        },
        {
          kind: "todo",
          text: "All patient names and relatives' names",
        },
        {
          kind: "todo",
          text: "Addresses and contact details",
        },
        {
          kind: "todo",
          text: "NHS numbers and any other patient numbers",
        },
        {
          kind: "todo",
          text: "GMC numbers of colleagues you have assessed, referenced, or complained about",
        },
        {
          kind: "paragraph",
          text: "Gender and date of birth do **not** need anonymising for the GMC — but **WorkspaceICU must never hold patient-identifiable information in any form**, so anonymise fully before anything is attached here.",
        },
      ],
    },
    {
      heading: "Organising and cross-referencing",
      blocks: [
        {
          kind: "bullet",
          text: "Follow the online application structure: training/qualifications/CV sequences, then 14 HiLLO sequences, then the SSY sequence.",
        },
        {
          kind: "bullet",
          text: '**Never upload duplicates.** Provide one copy, list it under each relevant HiLLO, and state where it lives. An index document per HiLLO is valued by evaluators — the "My evidence" logs on each HiLLO page here generate exactly that.',
        },
        {
          kind: "bullet",
          text: "**Triangulate:** pair every claimed capability with more than one evidence type (e.g. SLE + logbook + reflection). Primary evidence of personal involvement outweighs unit-level data; caseload statistics support but never suffice alone.",
        },
        {
          kind: "bullet",
          text: "Group documents into combined PDFs to keep uploads manageable; everything must be legible and in English (certified translations where not).",
        },
        {
          kind: "bullet",
          text: "Verification: every piece of evidence needs the signed verifier pro forma; overseas qualifications must be authenticated.",
        },
      ],
    },
  ],
};
