import type { EditorBlock } from "../src/lib/blocks";
import {
  b,
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
  t,
  todo,
} from "./blocks";
import type {
  CurriculumHillo,
  CurriculumKC,
  CurriculumSection,
  CurriculumStrand,
} from "./cesr-curriculum";
import type { PackPage } from "./cesr-journey";

/**
 * CESR Journey v4 page generators (spec §4.1, §4.2): one page per HiLLO
 * and one sub-page per Key Capability, laid out from the data in
 * cesr-curriculum.ts. Layout lives here; wording lives there. Nothing
 * here computes anything — Status is a select the candidate sets, the
 * HiLLO page's sub-page list is the progress table, and the evidence
 * count comes from the KC page's Evidence relation.
 */

/** The Status convention (spec §4.1): free text in the app, stated in the how-tos. */
export const STATUS_VALUES = [
  "Not started",
  "Collecting",
  "Ready for review",
  "Signed off",
] as const;

/** Property ids on every KC page — stable across pack versions. */
export const KC_PROPERTY_IDS = [
  "status",
  "signed_off",
  "supervisor",
  "evidence",
] as const;

/** The four rows of a KC page, in the spec's order, Status seeded. */
export function kcProperties() {
  return [
    prop.select("status", "Status", STATUS_VALUES[0]),
    prop.date("signed_off", "Signed off"),
    prop.people("supervisor", "Supervisor"),
    prop.relation("evidence", "Evidence", "Evidence for"),
  ];
}

export const hilloTitle = (hillo: CurriculumHillo) =>
  `HiLLO ${hillo.n} — ${hillo.title}`;

export const kcTitle = (kc: CurriculumKC) => `KC ${kc.id} — ${kc.shortTitle}`;

/** Stable key of a HiLLO's supervisor summary synced block (spec §4.3). */
export const summaryKey = (n: number) => `cesr-hillo-${n}-summary`;

const STRAND_HEADINGS: Record<CurriculumStrand["kind"], string> = {
  wba: "Work-based assessments",
  clinical: "Clinical and experiential evidence",
  cpd: "CPD and courses",
};

function strandHeading(strand: CurriculumStrand): string {
  const heading = STRAND_HEADINGS[strand.kind];
  return strand.aim ? `${heading} (aim ${strand.aim})` : heading;
}

const statusList = STATUS_VALUES.join(" · ");

/**
 * The KC page (spec §4.1): how-to, the verbatim wording, the evidence
 * menu in three strands, a slot for the candidate's own routes, notes,
 * and a link back to the HiLLO page.
 */
export function kcPage(
  hillo: CurriculumHillo,
  kc: CurriculumKC,
  ids: { page: string; hilloPage: string },
): PackPage {
  return {
    id: ids.page,
    parentId: ids.hilloPage,
    title: kcTitle(kc),
    icon: "🎯",
    description: kc.text,
    properties: kcProperties(),
    blocks: [
      callout(
        "💡",
        [
          b("How to use this KC: "),
          t(
            "mark items below as you plan them; an item is done when you link the evidence page in the Evidence property above — ticks alone never change the status. Strike through (Cmd/Ctrl-Shift-S) anything that doesn't apply; bold what you're pursuing this placement. Set Status yourself (",
          ),
          t(statusList),
          t(
            "); your supervisor sets Signed off and puts their name in Supervisor.",
          ),
        ],
        "blue",
      ),
      quote(kc.text),
      ...(kc.note ? [p([i(kc.note)])] : []),
      h2("What could count"),
      ...kc.strands.flatMap((strand) => [
        h3(strandHeading(strand)),
        ...strand.items.map((item) => todo(md(item))),
      ]),
      h3("Your own routes"),
      todo([fill("add an evidence route the menu doesn't list")]),
      h2("Notes and gap plan"),
      p([
        fill(
          "what is still missing for this KC, where it will come from, and by when",
        ),
      ]),
      divider(),
      pageLink(ids.hilloPage, hilloTitle(hillo), hillo.icon),
    ],
  };
}

function checklist(section: CurriculumSection): EditorBlock[] {
  return [
    ...(section.intro ? [p(md(section.intro))] : []),
    ...section.items.map((item) => todo(md(item))),
  ];
}

/**
 * The HiLLO page (spec §4.2). `summary` is the supervisor summary block
 * as placed on this page — the synced-block source placement in the
 * pack (see `supervisorSummaryBlocks` for its seed content).
 */
export function hilloPage(
  hillo: CurriculumHillo,
  ids: { page: string; hub: string },
  summary: EditorBlock,
): PackPage {
  return {
    id: ids.page,
    parentId: ids.hub,
    title: hilloTitle(hillo),
    icon: hillo.icon,
    description: hillo.statement,
    blocks: [
      callout(
        "💡",
        [
          b("How to use this page: "),
          t(
            "your KCs are the sub-pages below; the list shows each one's status, sign-off and evidence from its own page. Work in the KC pages. The summary block is your supervisor's, and appears in meeting notes.",
          ),
        ],
        "blue",
      ),
      h2("What the curriculum asks for"),
      quote(hillo.statement),
      ...bullets(hillo.atAGlance.map(md)),
      ...(hillo.hilloLevel
        ? [
            h2("HiLLO-level evidence"),
            ...(hillo.hilloLevel.qualifier
              ? [p([i(hillo.hilloLevel.qualifier)])]
              : []),
            ...checklist(hillo.hilloLevel),
          ]
        : []),
      ...(hillo.required
        ? [
            h2("Required evidence"),
            callout(
              "⚠️",
              [
                b("The SSG requires these"),
                t(
                  hillo.required.qualifier
                    ? ` (${hillo.required.qualifier}). `
                    : ". ",
                ),
                t(
                  "Weak evidence here cannot be compensated by strength elsewhere.",
                ),
              ],
              "red",
              checklist(hillo.required),
            ),
          ]
        : []),
      ...(hillo.maintenance
        ? [
            h2("Maintenance route (>7 years)"),
            ...(hillo.maintenance.qualifier
              ? [p([i(hillo.maintenance.qualifier)])]
              : []),
            ...checklist(hillo.maintenance),
          ]
        : []),
      h2("Supervisor summary"),
      summary,
      divider(),
      pageLink(ids.hub, "HiLLOs", "🎯"),
    ],
  };
}

/** Seed content of a HiLLO's supervisor summary synced block (spec §4.2 item 6). */
export function supervisorSummaryBlocks(n: number): EditorBlock[] {
  return [
    callout(
      "🩺",
      [
        b(`HiLLO ${n} — supervisor summary. `),
        fill(
          "Supervisor: overall view of this HiLLO, and what would make it sufficient — sign and date",
        ),
      ],
      "green",
      [todo([fill("next action agreed")])],
    ),
  ];
}

/**
 * A HiLLO page and its KC sub-pages. `kcPageIds` are allocated by the
 * caller (one per KC, in order) so other pages can link to them.
 */
export function hilloTree(
  hillo: CurriculumHillo,
  ids: { page: string; hub: string; kcPages: string[] },
  summary: EditorBlock,
): PackPage[] {
  if (ids.kcPages.length !== hillo.kcs.length) {
    throw new Error(
      `HiLLO ${hillo.n}: ${ids.kcPages.length} page ids for ${hillo.kcs.length} KCs`,
    );
  }
  return [
    hilloPage(hillo, { page: ids.page, hub: ids.hub }, summary),
    ...hillo.kcs.map((kc, index) =>
      kcPage(hillo, kc, { page: ids.kcPages[index], hilloPage: ids.page }),
    ),
  ];
}
