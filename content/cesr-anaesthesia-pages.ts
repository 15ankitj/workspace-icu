import type { EditorBlock } from "../src/lib/blocks";
import {
  b,
  bullet,
  callout,
  divider,
  fill,
  h2,
  h3,
  i,
  p,
  pageLink,
  prop,
  quote,
  t,
  table,
  todo,
  todos,
} from "./blocks";
import {
  ANAESTHESIA_MILESTONES,
  MILESTONE_STRANDS,
  type MilestonePhase,
  type MilestoneStrand,
  type RotationMilestone,
} from "./cesr-anaesthesia-rotation";
import { STATUS_VALUES } from "./cesr-hillo-pages";
import type { PackPage, PackRelation } from "./cesr-journey";

/**
 * CESR Journey v7 page generators for the Anaesthesia rotation (HiLLO 10)
 * under Placements: an overview, the two phase pages, one page per
 * milestone, and the HiLLO 10 bundle checklist, laid out from the data in
 * cesr-anaesthesia-rotation.ts. Layout lives here; wording lives there.
 * Each milestone carries a Serves relation to the KC 10.x pages it
 * evidences, seeded by the pack, so the KC page lists its milestones under
 * "Rotation milestones". Nothing here computes anything: Status is a
 * select the candidate sets, with the KC pages' vocabulary; sign-off
 * stays on the KC page.
 */

export const ROTATION_TITLE = "Anaesthesia rotation";
export const PHASE_TITLES: Record<Exclude<MilestonePhase, "Both">, string> = {
  "Before the IAC": "Before the IAC",
  "After the IAC": "After the IAC",
};
export const BUNDLE_TITLE = "HiLLO 10 bundle";

/** Property ids on every milestone page, in order — stable across versions. */
export const MILESTONE_PROPERTY_IDS = [
  "status",
  "phase",
  "strand",
  "evidence_expected",
  "evidence",
  "serves",
] as const;

/** Milestone page icon by strand. */
export const STRAND_ICONS: Record<MilestoneStrand, string> = {
  Logbook: "📓",
  "Practical skills": "🧤",
  SLEs: "📝",
  Rota: "📅",
  CPD: "🎓",
};

/**
 * The six rows of a milestone page. Status comes first because the
 * sub-page list shows a child's first select with a value, so the phase
 * page's list reads as a status board; Status is seeded like a KC page.
 */
export function milestoneProperties(m: RotationMilestone) {
  return [
    prop.select("status", "Status", STATUS_VALUES[0]),
    prop.select("phase", "Phase", m.phase),
    prop.select("strand", "Strand", m.strand),
    prop.select("evidence_expected", "Evidence expected", m.evidence),
    prop.relation("evidence", "Evidence", "Rotation evidence for"),
    prop.relation("serves", "Serves", "Rotation milestones"),
  ];
}

/** The phase page a milestone lives under: Both sits with Before the IAC. */
export function phaseOf(m: RotationMilestone): Exclude<MilestonePhase, "Both"> {
  return m.phase === "After the IAC" ? "After the IAC" : "Before the IAC";
}

const statusList = STATUS_VALUES.join(" · ");

/** What each Status value means on a milestone, one sentence each. */
const MILESTONE_STATUS_MEANINGS: Record<
  (typeof STATUS_VALUES)[number],
  string
> = {
  "Not started": "nothing planned or done yet.",
  Collecting: "working on it.",
  "Ready for review":
    "evidence linked, to be confirmed at the next supervision meeting.",
  "Signed off": "confirmed at that meeting.",
};

export interface RotationIds {
  rotation: string;
  before: string;
  after: string;
  bundle: string;
  /** One page id per milestone, by milestone id. */
  milestones: Record<string, string>;
  /** Pages the tree links to elsewhere in the pack. */
  placements: string;
  hillo10: string;
  evidenceRules: string;
  meetings: string;
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

const howTo = (text: string) =>
  callout("💡", [b("How to use this page: "), t(text)], "blue");

function milestonePageId(ids: RotationIds, m: RotationMilestone): string {
  const id = ids.milestones[m.id];
  if (!id)
    throw new Error(`Anaesthesia rotation: no page id for milestone ${m.id}`);
  return id;
}

function overviewPage(ids: RotationIds): PackPage {
  return {
    id: ids.rotation,
    parentId: ids.placements,
    title: ROTATION_TITLE,
    icon: "🩺",
    blocks: [
      howTo(
        "this tree is the plan for the anaesthesia year, phase by phase. Work in the milestone pages: set Status, link the evidence, and the KC 10.x pages list what each milestone serves. The GMC's requirements are on the HiLLO 10 page; this is how you get there.",
      ),
      noPhi(),
      h2("How the year runs"),
      p(
        "Before the IAC you work under direct supervision on ASA 1–2 elective and supervised emergency cases, and build the basic skills: airway, vascular access, induction and maintenance.",
      ),
      p(
        "The IAC is the hinge. Once it is signed off you move to indirect supervision, ASA 3 patients, emergency and out-of-hours work, and the regional and neuraxial techniques.",
      ),
      p(
        "After it the logbook must show breadth and progression, and the SLEs must be anaesthesia-specific: the GMC asks for at least 12 in addition to the IAC, and ICM SLEs do not count towards them.",
      ),
      h2("If you already hold an IAC"),
      p(
        "Tick the Before the IAC milestones as Signed off with the IAC certificate as their evidence, and start at After the IAC. If that training was more than seven years ago, the Maintenance route on the HiLLO 10 page applies.",
      ),
      h2("Your logbook"),
      p(
        "Case numbers live in your logbook app (Diary.ICU at St George's), not here. Before each supervision meeting, fill the logbook summary table on the phase page from an export.",
      ),
      h2("Milestone status"),
      p([
        t("Milestones use the same four values as the KC pages: "),
        b(statusList),
        t("."),
      ]),
      ...STATUS_VALUES.map((value) =>
        bullet([b(value), t(` — ${MILESTONE_STATUS_MEANINGS[value]}`)]),
      ),
      p(
        "If a competence was shown another way (simulation, a CBD, a DOPS in ICU), say so in the milestone's Notes and link that evidence — there is no separate status for it.",
      ),
      divider(),
      pageLink(ids.before, PHASE_TITLES["Before the IAC"], "1️⃣"),
      pageLink(ids.after, PHASE_TITLES["After the IAC"], "2️⃣"),
      pageLink(ids.bundle, BUNDLE_TITLE, "📦"),
      pageLink(ids.hillo10, "HiLLO 10 — Anaesthesia", "💉"),
      pageLink(ids.evidenceRules, "Evidence rules that apply everywhere", "📋"),
    ],
  };
}

/** The strand lists of a phase page: `###` per strand, then its page links. */
function strandLists(
  ids: RotationIds,
  phase: Exclude<MilestonePhase, "Both">,
): EditorBlock[] {
  return MILESTONE_STRANDS.flatMap((strand) => {
    const items = ANAESTHESIA_MILESTONES.filter(
      (m) => m.strand === strand && (m.phase === phase || m.phase === "Both"),
    );
    return [
      h3(strand),
      ...(items.length
        ? items.map((m) =>
            pageLink(
              milestonePageId(ids, m),
              phase === "After the IAC" && m.phase === "Both"
                ? `${m.title} (continues)`
                : m.title,
              STRAND_ICONS[m.strand],
            ),
          )
        : [
            p([
              i(
                phase === "Before the IAC"
                  ? "No rota milestones before the IAC: rota evidence starts once you join the anaesthetic rota after it."
                  : `No ${strand.toLowerCase()} milestones in this phase.`,
              ),
            ]),
          ]),
    ];
  });
}

function logbookSummary(rows: string[]): EditorBlock[] {
  return [
    h2("Logbook summary at last review"),
    table([
      ["Category", "Cases", "As at"],
      ...rows.map((row) => [row, [fill("number")], [fill("date")]]),
    ]),
  ];
}

function beforePage(ids: RotationIds): PackPage {
  return {
    id: ids.before,
    parentId: ids.rotation,
    title: PHASE_TITLES["Before the IAC"],
    icon: "1️⃣",
    blocks: [
      howTo(
        "the milestones below are your sub-pages; the list shows each one's phase, strand, evidence expected and status. Milestones marked Both continue after the IAC.",
      ),
      h2("Strands"),
      ...strandLists(ids, "Before the IAC"),
      ...logbookSummary([
        "Total",
        "Elective ASA 1–2",
        "Emergency",
        "Supraglottic airway",
        "Tracheal intubation",
      ]),
      h2("The IAC"),
      todo([t("IAC completed: "), fill("date and assessor")]),
      todo(
        "IAC certificate filed as an Evidence item and linked from the Before the IAC milestones",
      ),
      divider(),
      pageLink(ids.rotation, ROTATION_TITLE, "🩺"),
    ],
  };
}

function afterPage(ids: RotationIds): PackPage {
  return {
    id: ids.after,
    parentId: ids.rotation,
    title: PHASE_TITLES["After the IAC"],
    icon: "2️⃣",
    blocks: [
      howTo(
        "the milestones below are your sub-pages; the list shows each one's phase, strand, evidence expected and status. Milestones marked Both continue from before the IAC and are listed again here.",
      ),
      h2("Strands"),
      ...strandLists(ids, "After the IAC"),
      ...logbookSummary([
        "Total",
        "Elective ASA 1–3",
        "Emergency ASA 1E–3E",
        "Out of hours",
        "Obstetric",
        "Trauma",
        "Regional",
        "Neuraxial",
      ]),
      h2("Supervisor reports"),
      ...todos([
        "Mid-placement supervisor report obtained",
        "End-of-placement supervisor report confirming the equivalent of a year of anaesthesia training",
      ]),
      divider(),
      pageLink(ids.rotation, ROTATION_TITLE, "🩺"),
    ],
  };
}

export function milestonePage(
  m: RotationMilestone,
  ids: {
    page: string;
    phasePage: string;
    phaseTitle: string;
    phaseIcon: string;
  },
): PackPage {
  return {
    id: ids.page,
    parentId: ids.phasePage,
    title: m.title,
    icon: STRAND_ICONS[m.strand],
    description: `Evidence expected: ${m.evidence}`,
    properties: milestoneProperties(m),
    blocks: [
      callout(
        "💡",
        [
          b("How to use this milestone: "),
          t("set Status as you go ("),
          t(statusList),
          t(
            "); link the Evidence item that proves it in Evidence. Serves lists the KC pages this milestone counts towards — the KC page is where your supervisor signs off the capability; a milestone is Signed off when it is confirmed at a supervision meeting.",
          ),
        ],
        "blue",
      ),
      ...(m.note ? [quote(m.note)] : []),
      h2("Notes"),
      p([
        fill(
          "where the evidence is, who assessed it, what is still needed — or how the competence was shown another way",
        ),
      ]),
      divider(),
      pageLink(ids.phasePage, ids.phaseTitle, ids.phaseIcon),
    ],
  };
}

function bundlePage(ids: RotationIds): PackPage {
  return {
    id: ids.bundle,
    parentId: ids.rotation,
    title: BUNDLE_TITLE,
    icon: "📦",
    blocks: [
      howTo(
        "the anaesthesia-specific checks before submission; the general ones are on Evidence rules and in the Pre-submission meeting template.",
      ),
      ...todos([
        "Anonymised logbook over 12 months with a breakdown by specialty, ASA grade, airway and regional technique",
        "Every anaesthesia SLE form signed and dated — at least 12 in addition to the IAC, none of them ICM SLEs",
        "IAC certificate",
        "Supervisor reports confirming the equivalent of a year of anaesthesia training",
        "Sample rotas showing daytime sessions and out-of-hours work",
        "Certificates for every CPD milestone marked Signed off",
        "Each milestone marked Signed off has an Evidence item linked, and each KC 10.x page shows its evidence",
        "Reflections on at least one critical incident and one difficult airway",
      ]),
      divider(),
      pageLink(ids.hillo10, "HiLLO 10 — Anaesthesia", "💉"),
      pageLink(ids.evidenceRules, "Evidence rules that apply everywhere", "📋"),
      pageLink(ids.meetings, "Supervision meetings", "🤝"),
    ],
  };
}

/**
 * The rotation tree and its relations. `kcPageIds` maps a KC id
 * ("10.4") to its page id in the same template; a milestone that serves
 * a KC with no page is a build error — the pack must never ship a
 * dangling link.
 */
export function anaesthesiaRotationTree(
  ids: RotationIds,
  kcPageIds: Record<string, string>,
): { pages: PackPage[]; relations: PackRelation[] } {
  const phasePage = (phase: Exclude<MilestonePhase, "Both">) =>
    phase === "Before the IAC"
      ? {
          phasePage: ids.before,
          phaseTitle: PHASE_TITLES[phase],
          phaseIcon: "1️⃣",
        }
      : {
          phasePage: ids.after,
          phaseTitle: PHASE_TITLES[phase],
          phaseIcon: "2️⃣",
        };

  const milestones = ANAESTHESIA_MILESTONES.map((m) =>
    milestonePage(m, {
      page: milestonePageId(ids, m),
      ...phasePage(phaseOf(m)),
    }),
  );

  const relations: PackRelation[] = ANAESTHESIA_MILESTONES.flatMap((m) =>
    m.serves.map((kc) => {
      const target = kcPageIds[kc];
      if (!target) {
        throw new Error(
          `Anaesthesia rotation: milestone ${m.id} serves KC ${kc}, which has no page`,
        );
      }
      return {
        sourcePageId: milestonePageId(ids, m),
        propertyId: "serves",
        targetPageId: target,
      };
    }),
  );

  // Sidebar order: Before, After, then the bundle under the overview; the
  // milestones sit under their phase page in data order.
  return {
    pages: [
      overviewPage(ids),
      beforePage(ids),
      afterPage(ids),
      bundlePage(ids),
      ...milestones,
    ],
    relations,
  };
}
