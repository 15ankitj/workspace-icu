import { randomUUID } from "node:crypto";
import type { EditorBlock } from "../src/lib/blocks";
import {
  b,
  bookmark,
  bullet,
  bullets,
  callout,
  divider,
  fill,
  h2,
  i,
  p,
  pageLink,
  quote,
  t,
  table,
  todo,
  todos,
  toggle,
} from "./blocks";

/**
 * CESR Journey — the first content pack (brief §11). Structure and
 * guidance are complete; curriculum-specific wording (HiLLO descriptors,
 * Key Capabilities) is left as «placeholders» for the platform owner to
 * paste from the FICM source so nothing is paraphrased inaccurately.
 * Everything here is generic guidance — no patient details, ever.
 */

export interface PackPage {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  /** Blocks, or groups of blocks from `bullets`/`todos`; flattened on build. */
  blocks: (EditorBlock | EditorBlock[])[];
}

export interface PackTemplate {
  name: string;
  purpose: string;
  description: string;
  category: string;
  audience: string;
  kind: "page" | "tree" | "workspace";
  pages: PackPage[];
}

const NO_PHI = callout(
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
    evidence: randomUUID(),
    resources: randomUUID(),
  };
  const hilloIds = Array.from({ length: 14 }, () => randomUUID());

  const start: PackPage = {
    id: ids.start,
    parentId: null,
    title: "Start here",
    icon: "👋",
    blocks: [
      howTo(
        "read this page once, then work mostly in My plan and the HiLLO pages. Share this workspace with your supervisor (Settings → Invite, role Editor) so meetings and comments happen in the same place.",
      ),
      NO_PHI,
      h2("What this workspace is"),
      p(
        "A working file for your CESR / Portfolio Pathway application in Intensive Care Medicine: one page per High-Level Learning Outcome, a place to plan, a running evidence index, and supervision meetings recorded where the evidence lives.",
      ),
      p(
        "It is not a clinical record and not your formal portfolio submission — it is where you build the case, so that the submission is a matter of assembling what is already organised.",
      ),
      h2("How it fits together"),
      bullet([b("My plan"), t(" — target date, placements, milestones.")]),
      bullet([
        b("HiLLOs"),
        t(
          " — one page per outcome: what is asked, what good evidence looks like, a Key Capability checklist, your evidence, supervisor comments, gaps.",
        ),
      ]),
      bullet([
        b("Supervision meetings"),
        t(
          " — one page per meeting, started from the meeting templates in the gallery.",
        ),
      ]),
      bullet([
        b("Placements"),
        t(" — unit-specific guidance seeded from existing documents."),
      ]),
      bullet([
        b("Reflections"),
        t(" — quick capture with the reflection template."),
      ]),
      bullet([
        b("Evidence index"),
        t(" — every item of evidence in one table."),
      ]),
      bullet([
        b("Resources"),
        t(" — GMC and FICM guidance, FAQs, what assessors look for."),
      ]),
      h2("What to share with your supervisor"),
      bullets([
        "Invite your supervisor as an Editor so they can write in the Supervisor comments callouts and co-edit meeting pages live.",
        "Keep drafts and personal notes as Private pages (page menu) — they stay yours even in a shared workspace.",
        "Before each meeting, tick the KCs you believe you have evidenced and link the evidence; the meeting page then writes itself.",
      ]),
      h2("Suggested rhythm"),
      todos([
        "Weekly: add new evidence to the Evidence index and the relevant HiLLO page",
        "Monthly: review gaps on each HiLLO page and update My plan",
        "Each placement: initial, mid-placement and end-of-placement meetings",
        "Three months before submission: pre-submission meeting and readiness checklist",
      ]),
      divider(),
      pageLink(ids.plan, "My plan", "🗺️"),
      pageLink(ids.hillos, "HiLLOs", "🎯"),
      pageLink(ids.meetings, "Supervision meetings", "🤝"),
      pageLink(ids.evidence, "Evidence index", "📚"),
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
        "Evidence mapped to every HiLLO, with no red gaps",
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
        "each sub-page is one High-Level Learning Outcome. Work through them in the order your placements make evidence available, not numerically. Use the status column here as your at-a-glance map; computed completion and the RAG view arrive with databases in a later release.",
      ),
      h2("Overview"),
      table([
        ["HiLLO", "Status", "Notes"],
        ...hilloIds.map((_, index) => [
          [t(`HiLLO ${index + 1}`)],
          [fill("Not started / In progress / Evidenced")],
          [t("")],
        ]),
      ]),
      divider(),
      ...hilloIds.map((id, index) => pageLink(id, `HiLLO ${index + 1}`, "🎯")),
    ],
  };

  const hillos: PackPage[] = hilloIds.map((id, index) => {
    const n = index + 1;
    return {
      id,
      parentId: ids.hillos,
      title: `HiLLO ${n}`,
      icon: "🎯",
      blocks: [
        howTo(
          "paste the outcome and its Key Capabilities from the FICM curriculum, then tick capabilities as evidence accumulates. Your supervisor writes in the green callout; keep gaps honest.",
        ),
        h2("What the curriculum asks for"),
        p([
          fill(
            `Paste the HiLLO ${n} title and descriptor from the FICM Curriculum for Training in Intensive Care Medicine (2021)`,
          ),
        ]),
        h2("What good evidence looks like"),
        bullets([
          "Direct observation of practice across a range of cases and settings, with the observer's assessment recorded",
          "Reflective entries that name the Key Capability they speak to and what changed in your practice",
          "Logbook extracts, course and life-support certificates, teaching records and multi-source feedback",
          [
            b("For CESR: "),
            t(
              "evidence must be yours, verifiable, current, anonymised, and explicitly mapped to this outcome",
            ),
          ],
        ]),
        h2("Key Capabilities"),
        ...todos([
          [t(`KC ${n}.1 — `), fill("paste key capability")],
          [t(`KC ${n}.2 — `), fill("paste key capability")],
          [t(`KC ${n}.3 — `), fill("paste key capability")],
          [t(`KC ${n}.4 — `), fill("paste key capability")],
          [t(`KC ${n}.5 — `), fill("paste key capability")],
          [t(`KC ${n}.6 — `), fill("paste key capability")],
        ]),
        h2("My evidence"),
        p([
          i(
            "Describe each item, link it (a page in this workspace, or a bookmark) or attach the anonymised document. Add it to the Evidence index too.",
          ),
        ]),
        table([
          ["Evidence", "Type", "Date", "Where", "KCs covered"],
          [
            [fill("title")],
            [fill("WPBA / reflection / certificate / feedback")],
            [fill("date")],
            [fill("link or attachment")],
            [fill("e.g. 1.1, 1.3")],
          ],
        ]),
        h2("Supervisor comments"),
        callout(
          "🩺",
          [
            fill(
              "Supervisor: comment here on the evidence above — sign with your name and the date",
            ),
          ],
          "green",
        ),
        h2("Gaps and next actions"),
        ...todos([
          [
            fill(
              "gap — what evidence is still needed and where it will come from",
            ),
          ],
          [fill("action — who, what, by when")],
        ]),
        divider(),
        pageLink(ids.hillos, "HiLLOs", "🎯"),
      ],
    };
  });

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
    blocks: [
      howTo(
        "capture quickly, reflect properly later. Start each reflection from the Reflection template in the gallery as a sub-page here, then link it from the HiLLO it evidences.",
      ),
      NO_PHI,
      h2("Quick capture"),
      p([i("A line or two now, a full reflection within the week:")]),
      ...todos([[fill("what happened, in one line, anonymised")]]),
      h2("Reflection log"),
      table([
        ["Date", "Topic", "HiLLO / KC", "Page"],
        [
          [fill("date")],
          [fill("topic")],
          [fill("e.g. 3 / 3.2")],
          [fill("link")],
        ],
      ]),
    ],
  };

  const evidence: PackPage = {
    id: ids.evidence,
    parentId: null,
    title: "Evidence index",
    icon: "📚",
    blocks: [
      howTo(
        "every item of evidence gets a row here as well as on its HiLLO page. This table becomes a proper database — with filters, rollups and computed completion — in a later release; keep the columns as they are so it migrates cleanly.",
      ),
      table([
        [
          "#",
          "Evidence",
          "Type",
          "Date",
          "HiLLO(s)",
          "KC(s)",
          "Where",
          "Verified",
          "Status",
        ],
        [
          [t("1")],
          [fill("title")],
          [fill("type")],
          [fill("date")],
          [fill("1, 4")],
          [fill("1.2, 4.1")],
          [fill("page / attachment / external")],
          [fill("by whom")],
          [fill("Draft / Ready / Submitted")],
        ],
      ]),
      h2("Evidence types"),
      bullets([
        [
          b("WPBA"),
          t(
            " — direct observation, case-based discussion, procedure assessments",
          ),
        ],
        [b("Reflection"), t(" — structured reflective entries")],
        [
          b("Feedback"),
          t(
            " — multi-source feedback, patient/relative feedback where appropriate and anonymised",
          ),
        ],
        [
          b("Activity"),
          t(" — logbook, teaching delivered, QI, audit, management, research"),
        ],
        [b("Certificate"), t(" — courses, life support, qualifications")],
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
      "Start here, My plan, one page per HiLLO with Key Capability checklists and supervisor comments, supervision meeting hub, placement guidance, reflections, an evidence index and curated resources. Curriculum wording is left as placeholders to paste from the FICM source. Pair it with the Supervision meeting, Reflection, Evidence cover sheet and PDP page templates.",
    category: "Training & Portfolio",
    audience: "ICM CESR / Portfolio Pathway candidates and their supervisors",
    kind: "workspace",
    pages: [
      start,
      plan,
      hillosHub,
      ...hillos,
      meetings,
      placements,
      placementPage(ids.picu, "PICU guidance", "🧸"),
      placementPage(ids.neuro, "Neuro ICU guidance", "🧠"),
      reflections,
      evidence,
      resources,
    ],
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
): PackTemplate {
  return {
    name: `Supervision meeting — ${variant}`,
    purpose,
    description: `Structured note for a ${variant.toLowerCase()} supervision meeting. Candidate and supervisor edit it together during the meeting; agreed actions are to-dos.`,
    category: "Supervision",
    audience: "CESR candidates and supervisors",
    kind: "page",
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
    ),
    meetingTemplate(
      "End-of-placement",
      "Summary of achievement and the supervisor's overall comment for the record",
      "the record that travels with the candidate: what was evidenced here, the supervisor's overall view, and what the next placement must cover.",
      [
        h2("Summary of achievement"),
        table([
          ["HiLLO", "Evidence gained this placement", "Status"],
          [
            [fill("n")],
            [fill("items")],
            [fill("evidenced / in progress / not addressed")],
          ],
        ]),
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
    ),
    meetingTemplate(
      "Pre-submission",
      "Readiness checklist, outstanding gaps and sign-off before the application goes in",
      "run through every item; anything unticked is a reason to delay. Sign-off means both of you believe the bundle is complete, verified and anonymised.",
      [
        h2("Readiness checklist"),
        ...todos([
          "Every HiLLO has mapped, verified evidence with no red gaps",
          "Evidence index complete and matches the bundle",
          "Every document anonymised and re-checked",
          "CV and application form complete and consistent with the evidence",
          "Structured references and verifiers confirmed and contactable",
          "Reflections cover the breadth of the curriculum",
          "Submission logistics (fees, formats, deadlines) confirmed",
        ]),
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
    ),
    {
      name: "Reflection",
      purpose:
        "A structured reflective entry mapped to a HiLLO and Key Capability",
      description:
        "What happened, so what, now what — with learning and actions, and the outcome it evidences. Anonymised by design.",
      category: "Training & Portfolio",
      audience: "Anyone building a portfolio",
      kind: "page",
      pages: [
        {
          id: randomUUID(),
          parentId: null,
          title: "Reflection",
          icon: "💭",
          blocks: [
            howTo(
              "write it within a week of the event, anonymised, and link it from the HiLLO page it evidences.",
            ),
            NO_PHI,
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
      name: "Evidence cover sheet",
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
