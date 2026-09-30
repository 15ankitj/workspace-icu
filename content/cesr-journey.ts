import { randomUUID } from "node:crypto";
import type { EditorBlock } from "../src/lib/blocks";
import type { PagePropertyRow } from "../src/lib/page-properties";
import {
  b,
  bookmark,
  bullet,
  bullets,
  callout,
  divider,
  fill,
  h2,
  h3,
  i,
  md,
  p,
  pageLink,
  prop,
  quote,
  synced,
  t,
  table,
  todo,
  todos,
  toggle,
} from "./blocks";
import { CESR_CURRICULUM } from "./cesr-curriculum";
import { EVIDENCE_RULES } from "./cesr-evidence-rules";
import {
  hilloTitle,
  hilloTree,
  STATUS_VALUES,
  summaryKey,
  supervisorSummaryBlocks,
} from "./cesr-hillo-pages";

/**
 * CESR Journey — the first content pack (brief §11), version 5: the v4
 * layout (docs/cesr-journey-v4-spec.md) with a corrected Start here. One
 * page per Key Capability with the verbatim curriculum wording from
 * content/cesr-curriculum.ts, Status / Signed off / Supervisor properties
 * and an Evidence relation; evidence items are pages linked from the KCs;
 * the HiLLO page's sub-page list is
 * the progress table. Every fact is entered once, where it belongs, and
 * everything else is a view of it — nothing here computes anything.
 * Everything is generic guidance or curriculum text — no patient details,
 * ever.
 */

export interface PackPage {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  /** Authored content (Appendix A §2.2): the candidate's own voice. A
   *  copy opens non-authors in Suggest mode; the candidate, as creator,
   *  accepts or rejects. Reflections and application narrative only —
   *  meeting records, HiLLO checklists and evidence logs stay direct-edit. */
  authored?: boolean;
  /** Page details rows (0014) as the page should carry them, built with
   *  `prop` from `blocks.ts`. Same shape as `PageProperties.rows`: people
   *  and date values are cleared by `propertiesForTemplate` on snapshot;
   *  select, text, link and relation rows travel. A relation row declares
   *  the property; the links it holds are the template's `relations`. */
  properties?: PagePropertyRow[];
  /** The one-line description under the title (0014), at most 500
   *  characters — the database refuses longer. */
  description?: string;
  /** Blocks, or groups of blocks from `bullets`/`todos`; flattened on build. */
  blocks: (EditorBlock | EditorBlock[])[];
}

/**
 * A relation link between two pack pages (Appendix B §4.5), by authoring
 * ids. `propertyId` names a relation row in the source page's
 * `properties`; the build script rejects a link whose pages or row are
 * not in the template, since a pack must never ship a dangling link.
 * Links are ordered per (source page, property) in declaration order.
 */
export interface PackRelation {
  sourcePageId: string;
  propertyId: string;
  targetPageId: string;
}

/** A synced block carried by a pack template (Appendix A §1.5). */
export interface PackSynced {
  id: string;
  /** Stable key, the same across packs and versions. */
  key: string;
  /** The page in this template that is its source; null when the block is
   *  resolved by key in the target workspace (placed by another template). */
  sourcePageId: string | null;
  title: string;
  /** Seed content, and the static copy when the key cannot be resolved. */
  blocks: EditorBlock[];
}

export interface PackTemplate {
  name: string;
  purpose: string;
  description: string;
  category: string;
  audience: string;
  kind: "page" | "tree" | "workspace";
  /** Bumped with a changelog when the pack's content changes; installing
   *  a newer bundled version adds a template version (never edits copies). */
  version: number;
  changelog: string;
  pages: PackPage[];
  synced?: PackSynced[];
  /** Relation links between pages of this template; travel in snapshot
   *  format 4 and are recreated between the copies on instantiation. */
  relations?: PackRelation[];
}

// ---------------------------------------------------------------------
// Supervisor summary blocks: one synced block per HiLLO (Appendix A §1.5,
// spec §4.3). Source on the HiLLO page; read-only on the HiLLOs hub;
// read-write in the mid-placement, end-of-placement and pre-submission
// meeting notes, so what a supervisor writes in a meeting lands on the
// HiLLO page. Keys `cesr-hillo-N-summary` are stable across packs and
// versions so a meeting note placed later resolves to the same blocks.
// The v3 `cesr-hillo-N-progress` tables are retired, not carried forward.
// ---------------------------------------------------------------------

const HILLO_COUNT = CESR_CURRICULUM.length;

const SUMMARIES = CESR_CURRICULUM.map((hillo) => ({
  n: hillo.n,
  id: randomUUID(),
  key: summaryKey(hillo.n),
}));

function summarySynced(sourcePageIds: (string | null)[]): PackSynced[] {
  return SUMMARIES.map((entry, index) => ({
    id: entry.id,
    key: entry.key,
    sourcePageId: sourcePageIds[index],
    title: `HiLLO ${entry.n} supervisor summary`,
    blocks: supervisorSummaryBlocks(entry.n),
  }));
}

/** The 14 summary blocks as placed on a meeting note (read-write), with the
 *  how-to line the spec puts above the review section (§4.7). */
function hilloReview(): EditorBlock[] {
  return [
    h2("HiLLO review"),
    p([
      i(
        "Before the meeting, open each HiLLO page: the sub-page list shows every KC's status and evidence count. Discuss ambers and reds; record sign-offs by setting Signed off and Supervisor on the KC page, not here.",
      ),
    ]),
    p([
      i(
        "The blocks below are the live supervisor summaries from the HiLLO pages: what is written here appears there too.",
      ),
    ]),
    ...SUMMARIES.map((entry) => synced(entry.id)),
  ];
}

const noPhi = () =>
  callout(
    "🚫",
    [
      b("Never add patient-identifiable information. "),
      t(
        "Describe cases in general terms, use relative dates, and anonymise every document before it goes anywhere near this workspace.",
      ),
    ],
    "red",
  );

function howTo(text: string): EditorBlock {
  return callout("💡", [b("How to use this page: "), t(text)], "blue");
}

// ---------------------------------------------------------------------
// Workspace template: CESR Journey
// ---------------------------------------------------------------------

export function cesrJourney(): PackTemplate {
  const ids = {
    start: randomUUID(),
    plan: randomUUID(),
    hillos: randomUUID(),
    meetings: randomUUID(),
    placements: randomUUID(),
    picu: randomUUID(),
    neuro: randomUUID(),
    reflections: randomUUID(),
    narrative: randomUUID(),
    evidence: randomUUID(),
    evidenceRules: randomUUID(),
    resources: randomUUID(),
  };
  const hilloIds = CESR_CURRICULUM.map(() => randomUUID());
  const kcIds = CESR_CURRICULUM.map((hillo) =>
    hillo.kcs.map(() => randomUUID()),
  );

  const start: PackPage = {
    id: ids.start,
    parentId: null,
    title: "Start here",
    icon: "👋",
    blocks: [
      howTo(
        "read this page once, then work in the Key Capability pages under each HiLLO. Share this workspace with your supervisor (Settings → Invite, role Editor) so sign-offs, summaries and meetings happen in the same place.",
      ),
      noPhi(),
      h2("What this workspace is"),
      p(
        "Your working file for a CESR / Portfolio Pathway application in Intensive Care Medicine: one page per Key Capability, one page per piece of evidence, and the links between them — so the submission is a matter of assembling what is already organised.",
      ),
      h2("Two contracts"),
      bullet([
        b("Your voice is protected. "),
        t(
          "Reflections and the Application narrative are authored content: your supervisor opens them in Suggest mode and proposes changes; you accept or reject each one, so the submission stays your voice. Page menu → Authorship shows who counts as an author.",
        ),
      ]),
      bullet([
        b("Drafts are private until you share them. "),
        t(
          "Mark a page Private from the ⋯ menu at the top of the page, or from its row in the sidebar, and it stays yours even in a shared workspace; everything else is visible to everyone you invite. Only the person who created a page can make it private.",
        ),
      ]),
      h2("The Status convention"),
      p([
        t(
          "Every Key Capability page has a Status. Use exactly these four values, spelled like this, so the HiLLO pages group sensibly: ",
        ),
        b(STATUS_VALUES.join(" · ")),
        t("."),
      ]),
      bullets([
        [b("You"), t(" set Status, and you link the evidence.")],
        [
          b("Your supervisor"),
          t(
            " sets Signed off (the date) and puts their name in Supervisor. Nothing else changes a KC's standing — ticks in the evidence menu are planning, not progress.",
          ),
        ],
      ]),
      h2("The evidence loop"),
      p(
        "Create an Evidence item under Evidence from the gallery template, fill its properties and anonymise it. Open each Key Capability page it supports and add the item to that page's Evidence property. The HiLLO page's list then shows the evidence against that KC, and the item's own page shows every KC it serves under Evidence for.",
      ),
      h2("Suggested rhythm"),
      todos([
        "Weekly: create an Evidence item for anything new and link it from the KC pages it supports",
        "Monthly: open each HiLLO page, read the sub-page list, and move any KC that is ready to Ready for review",
        "Each placement: initial, mid-placement and end-of-placement meetings, from the gallery templates",
        "Three months before submission: pre-submission meeting and readiness checklist",
      ]),
      divider(),
      pageLink(ids.plan, "My plan", "🗺️"),
      pageLink(ids.hillos, "HiLLOs", "🎯"),
      pageLink(ids.evidence, "Evidence", "📚"),
      pageLink(ids.meetings, "Supervision meetings", "🤝"),
      pageLink(ids.resources, "Resources", "🔗"),
    ],
  };

  const plan: PackPage = {
    id: ids.plan,
    parentId: null,
    title: "My plan",
    icon: "🗺️",
    blocks: [
      howTo(
        "set a target, map your placements to the HiLLOs they will evidence best, and keep the milestones ticking over. Revisit monthly.",
      ),
      h2("Target"),
      todo([t("Target submission date: "), fill("month and year")]),
      todo([t("Named supervisor(s): "), fill("names and roles")]),
      todo([t("Educational supervisor / CESR lead informed: "), fill("date")]),
      h2("Placements"),
      table([
        ["Placement", "Unit", "Dates", "Supervisor", "HiLLOs in focus"],
        [
          [fill("e.g. General ICU")],
          [fill("unit")],
          [fill("from – to")],
          [fill("name")],
          [fill("HiLLO numbers")],
        ],
        [
          [fill("e.g. PICU")],
          [fill("unit")],
          [fill("from – to")],
          [fill("name")],
          [fill("HiLLO numbers")],
        ],
        [
          [fill("e.g. Neuro ICU")],
          [fill("unit")],
          [fill("from – to")],
          [fill("name")],
          [fill("HiLLO numbers")],
        ],
      ]),
      h2("Milestones"),
      todos([
        "Read the current FICM curriculum and the GMC Portfolio Pathway guidance (see Resources)",
        "Complete a baseline self-assessment against all 14 HiLLOs",
        "Agree the plan with your supervisor at the initial meeting",
        "Every KC at Ready for review or Signed off (check each HiLLO page's sub-page list)",
        "Structured reference and verification of evidence arranged",
        "CV, application form and evidence bundle drafted",
        "Pre-submission meeting and readiness checklist complete",
        "Submitted",
      ]),
      h2("Risks and mitigations"),
      table([
        ["Risk", "Mitigation"],
        [
          [fill("e.g. limited exposure to a subspecialty")],
          [fill("planned placement, secondment or course")],
        ],
      ]),
    ],
  };

  const hillosHub: PackPage = {
    id: ids.hillos,
    parentId: null,
    title: "HiLLOs",
    icon: "🎯",
    blocks: [
      howTo(
        "each sub-page is one High-Level Learning Outcome, and its sub-pages are the Key Capabilities — that list is your progress table, read from each KC page's properties. Work through them in the order your placements make evidence available, not numerically. The summary blocks below are your supervisor's, shown read-only here: they write on the HiLLO page or in a meeting note.",
      ),
      h2("Overview"),
      ...CESR_CURRICULUM.flatMap((hillo, index) => [
        pageLink(hilloIds[index], hilloTitle(hillo), hillo.icon),
        synced(SUMMARIES[index].id, true),
      ]),
    ],
  };

  const hillos: PackPage[] = CESR_CURRICULUM.flatMap((hillo, index) =>
    hilloTree(
      hillo,
      { page: hilloIds[index], hub: ids.hillos, kcPages: kcIds[index] },
      synced(SUMMARIES[index].id),
    ),
  );

  const meetings: PackPage = {
    id: ids.meetings,
    parentId: null,
    title: "Supervision meetings",
    icon: "🤝",
    blocks: [
      howTo(
        "create each meeting as a sub-page of this one from the gallery templates — Initial, Mid-placement, End-of-placement and Pre-submission — and log it in the table. Both of you edit the page live during the meeting.",
      ),
      h2("Meeting log"),
      table([
        ["Date", "Type", "Supervisor", "Page"],
        [
          [fill("date")],
          [fill("Initial")],
          [fill("name")],
          [fill("link to the meeting page")],
        ],
      ]),
      h2("Templates"),
      bullets([
        [
          b("Supervision meeting — Initial"),
          t(": objectives, baseline against HiLLOs, agreed plan"),
        ],
        [
          b("Supervision meeting — Mid-placement"),
          t(": progress, evidence reviewed, concerns, actions"),
        ],
        [
          b("Supervision meeting — End-of-placement"),
          t(": summary of achievement, supervisor's overall comment"),
        ],
        [
          b("Supervision meeting — Pre-submission"),
          t(": readiness checklist, outstanding gaps, sign-off"),
        ],
      ]),
      p([
        i(
          "Open the gallery (sidebar), pick a meeting template, then move the new page under this one.",
        ),
      ]),
    ],
  };

  const placements: PackPage = {
    id: ids.placements,
    parentId: null,
    title: "Placements",
    icon: "🏥",
    blocks: [
      howTo(
        "one sub-page per unit with the local guidance a CESR candidate needs: what the placement offers, which HiLLOs it evidences well, who to ask. Seed these from your existing documents with Import (sidebar), then tidy.",
      ),
      pageLink(ids.picu, "PICU guidance", "🧸"),
      pageLink(ids.neuro, "Neuro ICU guidance", "🧠"),
    ],
  };

  function placementPage(id: string, title: string, icon: string): PackPage {
    return {
      id,
      parentId: ids.placements,
      title,
      icon,
      blocks: [
        callout(
          "📥",
          [
            b("Seed this page from your existing document: "),
            t(
              "Import (sidebar) accepts Word and Markdown files, keeps headings, lists and tables, and creates a new page — then drag it under Placements and delete this placeholder.",
            ),
          ],
          "yellow",
        ),
        h2("What this placement offers"),
        p([fill("case mix, procedures, typical rota, teaching")]),
        h2("HiLLOs this placement evidences well"),
        bullets([[fill("HiLLO numbers and why")]]),
        h2("Local process"),
        bullets([
          [fill("who supervises CESR candidates here")],
          [fill("how WPBAs are requested and recorded")],
          [fill("local induction, mandatory training, access")],
        ]),
        h2("Reading before you start"),
        bullets([
          [fill("guidelines, protocols, key papers — links or bookmarks")],
        ]),
      ],
    };
  }

  const reflections: PackPage = {
    id: ids.reflections,
    parentId: null,
    title: "Reflections",
    icon: "💭",
    authored: true,
    blocks: [
      howTo(
        "capture quickly, reflect properly later. Start each reflection from the Reflection template in the gallery as a sub-page here — the list below is your log — then open the Key Capability pages it evidences and add it to their Evidence property.",
      ),
      noPhi(),
      h2("Quick capture"),
      p([i("A line or two now, a full reflection within the week:")]),
      ...todos([[fill("what happened, in one line, anonymised")]]),
    ],
  };

  const narrative: PackPage = {
    id: ids.narrative,
    parentId: null,
    title: "Application narrative",
    icon: "📝",
    authored: true,
    blocks: [
      howTo(
        "this page is your voice for the application: the gap statement and the narrative the form asks for. Your supervisor opens it in Suggest mode — accept what improves it, reject what changes what you mean. Build it from the HiLLO pages and the Evidence pages; write in general terms with no patient details.",
      ),
      noPhi(),
      h2("Summary of experience"),
      p([
        fill(
          "your career in ICM so far — posts, settings, duration, level of responsibility — in a few paragraphs",
        ),
      ]),
      h2("How my experience meets each HiLLO"),
      p([
        i(
          "One short paragraph per outcome: what you did, where the evidence is (evidence page titles), and how it shows the capability. Draft here, then paste into the application form.",
        ),
      ]),
      ...Array.from({ length: HILLO_COUNT }, (_, index) => [
        h3(`HiLLO ${index + 1}`),
        p([
          fill("narrative"),
          t(" — evidence: "),
          fill("evidence page titles"),
        ]),
      ]).flat(),
      h2("Gap statement"),
      p([
        i(
          "Where your evidence is thinner than the curriculum expects, say so, and say what you did or will do about it. Assessors read honesty as insight.",
        ),
      ]),
      table([
        ["Gap", "Why it exists", "What I did / will do", "Evidence"],
        [
          [fill("HiLLO / KC")],
          [fill("e.g. no PICU placement in this post")],
          [fill("placement, course, secondment, supervised cases")],
          [fill("evidence page titles")],
        ],
      ]),
      h2("Statement for the application form"),
      p([
        fill(
          "the final narrative, assembled from the sections above, in the word limit the form sets",
        ),
      ]),
      h2("Checks before you paste it in"),
      ...todos([
        "Every claim points at an evidence page linked from a Key Capability",
        "No patient-identifiable information anywhere",
        "All suggestions on this page accepted or rejected (exports are the clean state)",
        "Read aloud once: it sounds like you",
      ]),
    ],
  };

  const evidence: PackPage = {
    id: ids.evidence,
    parentId: null,
    title: "Evidence",
    icon: "📚",
    blocks: [
      howTo(
        "one page per item — create it here from the Evidence item template in the gallery, fill the properties, anonymise, then link it from the Key Capability pages it supports. The list below is your evidence index: type, date and consultant per row, sortable; each item's own page shows the KCs it serves under Evidence for.",
      ),
      noPhi(),
      h2("Where the evidence lives"),
      p([i("Set Stored as on each item to one of:")]),
      bullets([
        [
          b("Described"),
          t(
            " — the item's page describes it, and that anonymised description is the evidence.",
          ),
        ],
        [
          b("Linked"),
          t(
            " — the document lives elsewhere (your e-portfolio, a shared drive); put the URL in Link.",
          ),
        ],
        [
          b("Attached"),
          t(" — the anonymised document is uploaded to the item's page."),
        ],
      ]),
      h2("Rules that apply everywhere"),
      pageLink(ids.evidenceRules, "Evidence rules that apply everywhere", "📋"),
    ],
  };

  const evidenceRules: PackPage = {
    id: ids.evidenceRules,
    parentId: ids.evidence,
    title: "Evidence rules that apply everywhere",
    icon: "📋",
    blocks: [
      callout("ℹ️", md(EVIDENCE_RULES.intro), "blue"),
      ...EVIDENCE_RULES.sections.flatMap((section) => [
        h2(section.heading),
        ...section.blocks.map((block) =>
          block.kind === "todo"
            ? todo(md(block.text))
            : block.kind === "bullet"
              ? bullet(md(block.text))
              : p(md(block.text)),
        ),
      ]),
    ],
  };

  const resources: PackPage = {
    id: ids.resources,
    parentId: null,
    title: "Resources",
    icon: "🔗",
    blocks: [
      howTo(
        "the authoritative sources first, then local FAQs. Replace the bookmarks with the exact current guidance pages when you next check them.",
      ),
      h2("Authoritative guidance"),
      bookmark(
        "https://www.ficm.ac.uk",
        "Faculty of Intensive Care Medicine",
        "Curriculum for Training in ICM and Portfolio Pathway (CESR) guidance",
      ),
      bookmark(
        "https://www.gmc-uk.org",
        "General Medical Council",
        "Specialist registration via the Portfolio Pathway: application, evidence rules, verification",
      ),
      h2("FAQs"),
      toggle("What is the Portfolio Pathway?", [
        p(
          "The GMC route to the specialist register for doctors who have not completed a UK-approved training programme in the specialty, assessed on evidence that the applicant's knowledge, skills and experience are equivalent to those of a CCT holder.",
        ),
      ]),
      toggle("How much evidence does each HiLLO need?", [
        p(
          "Enough to show the capability across the breadth the curriculum describes, from more than one source, over time. Quality and mapping matter more than volume; a smaller, well-mapped, verified bundle beats a large unstructured one.",
        ),
      ]),
      toggle("Does evidence from outside the UK count?", [
        p(
          "Yes, where it is verifiable and demonstrates the capability. Check the current GMC guidance for verification requirements and time limits before relying on older evidence.",
        ),
      ]),
      h2("What assessors look for"),
      bullets([
        [b("Authenticity"), t(" — your evidence, verified by named people")],
        [
          b("Mapping"),
          t(" — every item tied explicitly to outcomes and capabilities"),
        ],
        [
          b("Currency"),
          t(" — recent evidence, or a clear account of maintained skills"),
        ],
        [
          b("Breadth"),
          t(
            " — the range of settings and patient groups the curriculum expects",
          ),
        ],
        [
          b("Reflection"),
          t(" — not just what you did, but what you learned and changed"),
        ],
        [
          b("Anonymisation"),
          t(" — no patient-identifiable information anywhere in the bundle"),
        ],
      ]),
      quote(
        "Build the file as you go; the application is then a matter of assembly, not archaeology.",
      ),
    ],
  };

  return {
    name: "CESR Journey",
    purpose:
      "A complete working file for a CESR / Portfolio Pathway application in ICM",
    description:
      "Start here, My plan, one page per HiLLO with one sub-page per Key Capability carrying the verbatim curriculum wording, Status / Signed off / Supervisor properties and an Evidence relation; an Evidence hub whose item pages are linked from the KCs; supervision meeting hub, placement guidance, reflections, application narrative and curated resources. Pair it with the Evidence item, Supervision meeting, Reflection, Evidence cover sheet and PDP page templates.",
    category: "Training & Portfolio",
    audience: "ICM CESR / Portfolio Pathway candidates and their supervisors",
    kind: "workspace",
    version: 5,
    changelog: "Start here: corrected where the Private option lives",
    pages: [
      start,
      plan,
      hillosHub,
      ...hillos,
      evidence,
      evidenceRules,
      meetings,
      placements,
      placementPage(ids.picu, "PICU guidance", "🧸"),
      placementPage(ids.neuro, "Neuro ICU guidance", "🧠"),
      reflections,
      narrative,
      resources,
    ],
    synced: summarySynced(hilloIds),
  };
}

// ---------------------------------------------------------------------
// Supporting page templates
// ---------------------------------------------------------------------

function meetingTemplate(
  variant: string,
  purpose: string,
  howToText: string,
  sections: (EditorBlock | EditorBlock[])[],
  release: { version: number; changelog: string; reviewsHillos: boolean } = {
    version: 1,
    changelog: "Initial version",
    reviewsHillos: false,
  },
): PackTemplate {
  return {
    name: `Supervision meeting — ${variant}`,
    purpose,
    description: `Structured note for a ${variant.toLowerCase()} supervision meeting. Candidate and supervisor edit it together during the meeting; agreed actions are to-dos.${release.reviewsHillos ? " Includes the live supervisor summary blocks from the CESR Journey workspace's HiLLO pages." : ""}`,
    category: "Supervision",
    audience: "CESR candidates and supervisors",
    kind: "page",
    version: release.version,
    changelog: release.changelog,
    synced: release.reviewsHillos
      ? summarySynced(SUMMARIES.map(() => null))
      : undefined,
    pages: [
      {
        id: randomUUID(),
        parentId: null,
        title: `Supervision meeting — ${variant}`,
        icon: "🤝",
        blocks: [
          howTo(howToText),
          h2("Meeting details"),
          table([
            ["Date", "Candidate", "Supervisor", "Placement"],
            [[fill("date")], [fill("name")], [fill("name")], [fill("unit")]],
          ]),
          ...sections,
          h2("Agreed actions"),
          ...todos([
            [fill("action — who, by when")],
            [fill("action — who, by when")],
          ]),
          h2("Next meeting"),
          p([fill("date and type")]),
        ],
      },
    ],
  };
}

export function supportingTemplates(): PackTemplate[] {
  return [
    meetingTemplate(
      "Initial",
      "Objectives, baseline against the HiLLOs, and the plan for the placement",
      "hold this in the first fortnight of a placement. Fill the baseline together; be candid about gaps — they are the plan.",
      [
        h2("Objectives for this placement"),
        ...todos([
          [fill("objective")],
          [fill("objective")],
          [fill("objective")],
        ]),
        h2("Baseline against the HiLLOs"),
        table([
          ["HiLLO", "Current position", "Priority here"],
          [
            [fill("n")],
            [fill("evidence so far")],
            [fill("high / medium / low")],
          ],
        ]),
        h2("Support and access"),
        bullets([
          [fill("WPBA assessors, courses, exposure the candidate needs")],
        ]),
      ],
    ),
    meetingTemplate(
      "Mid-placement",
      "Progress against objectives, evidence reviewed, concerns and course corrections",
      "review the evidence gathered so far against the initial objectives and adjust the plan for the second half.",
      [
        h2("Progress since the initial meeting"),
        p([fill("summary")]),
        ...hilloReview(),
        h2("Evidence reviewed"),
        table([
          ["Evidence", "HiLLO / KC", "Supervisor's view"],
          [
            [fill("item")],
            [fill("mapping")],
            [fill("meets / partial / not yet")],
          ],
        ]),
        h2("Concerns, wellbeing, workload"),
        p([fill("anything either party wants recorded")]),
      ],
      {
        version: 3,
        changelog:
          "HiLLO review now embeds the supervisor summary blocks (keys renamed from -progress to -summary); progress is read from the KC pages' properties.",
        reviewsHillos: true,
      },
    ),
    meetingTemplate(
      "End-of-placement",
      "Summary of achievement and the supervisor's overall comment for the record",
      "the record that travels with the candidate: what was evidenced here, the supervisor's overall view, and what the next placement must cover.",
      [
        h2("Summary of achievement"),
        p([
          fill(
            "what was evidenced this placement, in a paragraph — the summary blocks below carry the per-HiLLO detail",
          ),
        ]),
        ...hilloReview(),
        h2("Supervisor's overall comment"),
        callout(
          "🩺",
          [
            fill(
              "Supervisor: overall assessment of this placement — signed and dated",
            ),
          ],
          "green",
        ),
        h2("For the next placement"),
        bullets([[fill("outcomes still needing evidence")]]),
      ],
      {
        version: 3,
        changelog:
          "HiLLO review now embeds the supervisor summary blocks (keys renamed from -progress to -summary); progress is read from the KC pages' properties.",
        reviewsHillos: true,
      },
    ),
    meetingTemplate(
      "Pre-submission",
      "Readiness checklist, outstanding gaps and sign-off before the application goes in",
      "run through every item; anything unticked is a reason to delay. Sign-off means both of you believe the bundle is complete, verified and anonymised.",
      [
        h2("Readiness checklist"),
        ...todos([
          "Every KC at Signed off, or its gap named below",
          "Every evidence page's properties complete, and the Evidence list matches the bundle",
          "Every document anonymised and re-checked",
          "CV and application form complete and consistent with the evidence",
          "Structured references and verifiers confirmed and contactable",
          "Reflections cover the breadth of the curriculum",
          "Submission logistics (fees, formats, deadlines) confirmed",
        ]),
        ...hilloReview(),
        h2("Outstanding gaps"),
        ...todos([[fill("gap and plan")]]),
        h2("Sign-off"),
        callout(
          "✅",
          [
            fill(
              "Candidate and supervisor: names, date, and statement of readiness",
            ),
          ],
          "green",
        ),
      ],
      {
        version: 2,
        changelog:
          "Adds the HiLLO review section: the fourteen supervisor summary blocks from the CESR Journey workspace (keys cesr-hillo-N-summary), editable in the meeting; progress is read from the KC pages' properties. Readiness checklist reworded for KC pages and evidence pages.",
        reviewsHillos: true,
      },
    ),
    {
      name: "Reflection",
      version: 3,
      changelog:
        "Adds Date and Evidences (KC numbers) properties, so the Reflections page's sub-page list shows them. A reflection is evidence like any other item: link it from the Evidence property of each Key Capability page it supports, and it appears there under Evidence for.",
      purpose:
        "A structured reflective entry mapped to a HiLLO and Key Capability",
      description:
        "What happened, so what, now what — with learning and actions, and the outcome it evidences. Anonymised by design, and authored content: supervisors suggest, you accept. Link it from the Key Capability pages it supports.",
      category: "Training & Portfolio",
      audience: "Anyone building a portfolio",
      kind: "page",
      pages: [
        {
          id: randomUUID(),
          parentId: null,
          title: "Reflection",
          icon: "💭",
          authored: true,
          properties: [
            prop.date("date", "Date"),
            prop.text("kc_note", "Evidences (KC numbers)"),
          ],
          blocks: [
            howTo(
              "write it within a week of the event, anonymised. Set the Date and note the KC numbers it evidences above, then open each of those KC pages and add this page to its Evidence property — the KCs then appear here under Evidence for.",
            ),
            noPhi(),
            h2("Maps to"),
            p([t("HiLLO / KC: "), fill("e.g. 3 / 3.2")]),
            h2("What happened"),
            p([
              fill(
                "the situation, in general terms — no identifiers, relative dates",
              ),
            ]),
            h2("So what"),
            p([
              fill(
                "why it mattered; what you thought and felt; what went well and less well",
              ),
            ]),
            h2("Now what"),
            p([
              fill(
                "what you would do differently; what you need to learn or practise",
              ),
            ]),
            h2("Learning"),
            bullets([[fill("learning point")]]),
            h2("Actions"),
            ...todos([[fill("action")]]),
          ],
        },
      ],
    },
    {
      name: "Evidence item",
      version: 1,
      changelog: "Initial version",
      purpose:
        "One page per piece of evidence: what it is, when, who supervised it, where it lives — linked from the Key Capabilities it supports",
      description:
        "Type, date, supervising consultant, storage mode and link as properties; a description, and an anonymisation check. Create it under Evidence in a CESR Journey workspace, then add it to the Evidence property of each Key Capability page it supports: the KCs appear on this page under Evidence for, and the Evidence hub's sub-page list becomes your index.",
      category: "Training & Portfolio",
      audience: "CESR candidates",
      kind: "page",
      pages: [
        {
          id: randomUUID(),
          parentId: null,
          title: "Evidence item",
          icon: "📄",
          properties: [
            prop.select("type", "Type"),
            prop.date("date", "Date"),
            prop.text("consultant", "Supervising consultant"),
            prop.select("stored_as", "Stored as"),
            prop.link("link", "Link"),
          ],
          blocks: [
            howTo(
              "one page per item. Rename it to the item's title, fill the properties above, describe it below, anonymise anything you attach, then open each Key Capability page it supports and add this page to its Evidence property.",
            ),
            callout(
              "🏷️",
              [
                b("Conventions. "),
                t("Type is one of: "),
                b(
                  "CBD · DOPS · Mini-CEX · ACAT · MSF · Reflection · Certificate · Logbook · Letter · Audit/QI · Teaching · Other",
                ),
                t(". Stored as is one of: "),
                b("Described"),
                t(" (the description below is the evidence), "),
                b("Linked"),
                t(" (put the URL in Link), or "),
                b("Attached"),
                t(
                  " (upload the anonymised document below). Spell them exactly so the Evidence hub groups them.",
                ),
              ],
              "gray",
            ),
            noPhi(),
            h2("What it is"),
            p([
              fill(
                "what the evidence is and the context — in general terms, no identifiers, relative dates",
              ),
            ]),
            h2("Which capabilities it evidences"),
            p([
              i(
                "Link this page from the Evidence property of each KC it supports; the list appears here under Evidence for.",
              ),
            ]),
            h2("Anonymisation check"),
            ...todos([
              "Patient and relative names, addresses and contact details removed",
              "NHS numbers and any other patient numbers removed",
              "Colleagues' GMC numbers removed",
            ]),
          ],
        },
      ],
    },
    {
      name: "Evidence cover sheet",
      version: 1,
      changelog: "Initial version",
      purpose:
        "Front page for one item of evidence: what it is, what it shows, who verified it",
      description:
        "Attach or link the anonymised evidence, state the HiLLOs and Key Capabilities it demonstrates and why, and record verification.",
      category: "Training & Portfolio",
      audience: "CESR candidates",
      kind: "page",
      pages: [
        {
          id: randomUUID(),
          parentId: null,
          title: "Evidence cover sheet",
          icon: "📄",
          blocks: [
            howTo(
              "one sheet per item; keep the title identical to the Evidence index row.",
            ),
            table([
              ["Field", "Detail"],
              [[b("Title")], [fill("title")]],
              [
                [b("Type")],
                [fill("WPBA / reflection / feedback / activity / certificate")],
              ],
              [[b("Date")], [fill("date")]],
              [[b("HiLLO(s) / KC(s)")], [fill("mapping")]],
              [[b("Verified by")], [fill("name, role, date")]],
            ]),
            ...todos([
              "Anonymisation checked — no patient-identifiable information",
            ]),
            h2("Description"),
            p([fill("what the evidence is and the context")]),
            h2("Why it demonstrates the capability"),
            p([fill("the explicit link between the evidence and the outcome")]),
            h2("Attachment or link"),
            p([
              fill(
                "attach the anonymised document here (upload) or add a bookmark",
              ),
            ]),
          ],
        },
      ],
    },
    {
      name: "Personal development plan",
      version: 1,
      changelog: "Initial version",
      purpose: "Goals, actions and evidence of achievement with target dates",
      description:
        "A simple PDP table plus review notes, suitable for appraisal and supervision.",
      category: "Personal",
      audience: "Anyone",
      kind: "page",
      pages: [
        {
          id: randomUUID(),
          parentId: null,
          title: "Personal development plan",
          icon: "🌱",
          blocks: [
            howTo(
              "three to five goals at a time; review at each supervision meeting or appraisal.",
            ),
            table([
              [
                "Goal",
                "Actions",
                "Evidence of achievement",
                "Target date",
                "Status",
              ],
              [
                [fill("goal")],
                [fill("actions")],
                [fill("evidence")],
                [fill("date")],
                [fill("not started / in progress / achieved")],
              ],
            ]),
            h2("Review notes"),
            p([fill("date — what changed and why")]),
          ],
        },
      ],
    },
  ];
}
