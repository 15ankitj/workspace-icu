# WorkspaceICU — CESR Journey pack, version 4

**Status:** Content-pack specification, 25 September 2026 — approved for build
**Depends on:** Appendix B (relations) — merged and live in production (migrations 0025–0027, `FEATURE_RELATIONS=on`)
**Replaces:** CESR Journey v3 in `content/cesr-journey.ts`. v3 has **zero live instantiations** in production, so v4 is a clean rewrite of the pack's content, shipped as version 4 of the same templates (page keys preserved where titles match, so the update path keeps working for anyone who installs later).
**Audience:** Claude Code (build agent)

---

## 0. Why v4 exists

v3 was written for an app that had only pages and to-do blocks, so it simulated structure by hand: a progress table the candidate retypes, an evidence index table maintained in parallel with per-HiLLO evidence tables, KC checklists as plain to-dos with nowhere to attach the evidence. Every piece of information was entered two or three times, and nothing knew about anything else.

The app now has page properties (five types plus **relation**), a sub-page list that renders a child page's properties as a row, backlinks, synced blocks and authored content. v4 is designed around those, with one rule: **every fact is entered once, where it belongs, and everything else is a view of it.**

What this pack is *not*: it does not compute anything. Status is a select the human sets. Sufficiency is a judgement the supervisor records. That is the deliberate boundary from Appendix B; the pack must not try to fake rollups with tables.

## 1. The three primitives the pack is built on

1. **A KC is a page.** Each of the 92 Key Capabilities is a sub-page of its HiLLO page, carrying the verbatim curriculum wording, three properties (Status, Signed off, Supervisor) and one relation ("Evidence"). Its body is the *evidence menu*: the planning checklist of what could count.
2. **An evidence item is a page.** Each piece of evidence is a page under Evidence, carrying type, date, supervising consultant and storage mode as properties. It is linked *from* KC pages via the relation, so its own page shows "Evidence for: KC 12.7, KC 12.8" under the reverse label — the triangulation map for free.
3. **The HiLLO page's sub-page list is the progress table.** Because each KC is a child page with properties, the HiLLO page automatically shows *KC · Status · Signed off · Supervisor · N evidence* with the app's existing All / Mine / Recent filters. Nothing is typed into a table. The synced progress block from v3 is **retired**; what remains synced is the small per-HiLLO "supervisor summary" block (see §4.3), which is prose a human writes and which meetings need to see.

## 2. DSL extension (prerequisite — its own PR)

`content/blocks.ts` and `PackPage` cannot yet express properties or relation links, even though snapshot format 4 (`src/lib/templates.ts`) and `insert_template_pages` (migration 0025) can carry both. Extend the pack layer, changing nothing in the app:

### 2.1 `PackPage` gains `properties` and pages can declare relations

```ts
export interface PackPage {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  authored?: boolean;
  /** NEW: page details rows (0014) as the page should carry them.
   *  Same shape as PageProperties.rows; people/date values are cleared
   *  by propertiesForTemplate on snapshot, select/text/link/relation
   *  travel. Relation rows here declare the property; links are below. */
  properties?: PagePropertyRow[];
  /** NEW: optional one-line description under the title (0014). */
  description?: string;
  blocks: (EditorBlock | EditorBlock[])[];
}

/** NEW: a relation link between two pack pages, by authoring ids. */
export interface PackRelation {
  sourcePageId: string;
  propertyId: string;   // the relation row's id on the source page
  targetPageId: string;
}

export interface PackTemplate {
  // …existing…
  relations?: PackRelation[];   // NEW
}
```

Helpers in `blocks.ts`:

```ts
export const prop = {
  select: (id: string, label: string, value: string | null = null): PagePropertyRow => …,
  date:   (id: string, label: string): PagePropertyRow => …,   // value null
  people: (id: string, label: string): PagePropertyRow => …,   // value []
  text:   (id: string, label: string, value = ""): PagePropertyRow => …,
  link:   (id: string, label: string, value = ""): PagePropertyRow => …,
  relation: (id: string, label: string, reverseLabel: string): PagePropertyRow => …,
};
```

Property ids are **stable strings, not UUIDs** (`status`, `signed_off`, `supervisor`, `evidence`, `type`, `date`, `consultant`, `stored_as`), so a v5 update can find and extend them. They must match `ID_PATTERN` in `page-properties.ts` (`^[A-Za-z0-9_-]{1,40}$`).

### 2.2 Build script

`scripts/build-cesr-pack.ts`:
- Pass each page's `properties` through to `SourcePage` (as `{ hidden: [], rows }`), and `description`. `buildSnapshot` already runs `propertiesForTemplate` on them.
- Map `template.relations` to `SourceRelation[]` with authoring ids rewritten through `idOf()`, and pass them as `options.relations` to `buildSnapshot`. Position: declaration order, using `firstPosition()` / `positionAfter()` per (source, property).
- Relations whose either page is not in the template are a build **error** (not a note): a pack must never ship a dangling link.

### 2.3 Tests

Unit tests in `scripts/` or `src/lib`: a two-page pack with one relation builds to a format-4 snapshot whose `relations[0]` has the right keys; instantiation (existing `planInstantiation` tests) creates the link between the copies. Existing tests stay green.

## 3. Workspace tree (v4)

```
CESR Journey
├── 👋 Start here
├── 🗺️ My plan
├── 🎯 HiLLOs                         (hub: 14 page links + supervisor summaries, read-only embeds)
│   ├── 🏛️ HiLLO 1 — NHS systems, law and ethics
│   │   ├── KC 1.1 — <verbatim SSG wording>
│   │   ├── KC 1.2 — …
│   │   └── … (6)
│   ├── 🛡️ HiLLO 2 — Patient safety and quality improvement   (6 KCs)
│   ├── 🔬 HiLLO 3 — Research, appraisal and data              (6)
│   ├── 🎓 HiLLO 4 — Teaching and supervision                  (4)
│   ├── 🚨 HiLLO 5 — Resuscitation, stabilisation and transfer (11)
│   ├── 🖥️ HiLLO 6 — Investigations, monitoring, organ support (4)
│   ├── 🏥 HiLLO 7 — Perioperative critical care               (4)
│   ├── 🕊️ HiLLO 8 — Consequences of critical illness, EoL, organ donation (5)
│   ├── 👥 HiLLO 9 — Leading and managing a critical care service (5)
│   ├── 💉 HiLLO 10 — Anaesthesia                              (10)
│   ├── 🩺 HiLLO 11 — Medicine                                 (8)
│   ├── 🧠 HiLLO 12 — Neurosciences ICM                        (9)
│   ├── 🧸 HiLLO 13 — Paediatric ICM                           (6)
│   └── ❤️ HiLLO 14 — Cardiothoracic ICM                       (8)
├── 📚 Evidence                        (hub + rules page; evidence item pages are created here)
│   └── 📋 Evidence rules that apply everywhere
├── 🤝 Supervision meetings            (hub; meeting pages created here from gallery templates)
├── 🏥 Placements
│   ├── 🧸 PICU guidance
│   └── 🧠 Neuro ICU guidance
├── 💭 Reflections                     (authored)
├── 📝 Application narrative           (authored)
└── 🔗 Resources
```

92 KC pages + 14 HiLLO pages + 11 others = **117 pages** in the workspace template. That is large but correct: the KC pages are the product. Keep the sidebar sane by giving KC pages short titles (`KC 12.8 — Raised intracranial pressure`) and putting the verbatim wording in the page body and `description`.

The **Evidence index** page from v3 is **deleted**: the Evidence hub's sub-page list *is* the index, with type/date/consultant visible per row and sortable, and the evidence page's reverse relation shows which KCs it serves.

## 4. Page anatomy

### 4.1 KC page (×92) — the working unit

**Title:** `KC 12.8 — <short title>`. Short titles from the September pack (e.g. "Raised intracranial pressure"); verbatim SSG wording goes in `description` (≤500 chars; where the SSG wording is longer, the first sentence in `description` and the full text as the first paragraph).

**Properties (in this order):**
| id | type | label | seeded value |
|---|---|---|---|
| `status` | select | Status | `Not started` (options by convention: Not started · Collecting · Ready for review · Signed off) |
| `signed_off` | date | Signed off | — |
| `supervisor` | people | Supervisor | — |
| `evidence` | relation | Evidence | reverse label **Evidence for** |

`select` has no option list in the app (it is free text validated to 60 chars); the four values are a *convention* stated on Start here and in the KC page's how-to. Keep the four exactly as spelled so the sub-page list groups sensibly.

**Body:**
1. Callout (blue) *How to use this KC*: "Mark items below as you plan them; an item is *done* when you link the evidence page in the Evidence property above — ticks alone never change the status. Set Status yourself; your supervisor sets Signed off and puts their name in Supervisor."
2. Quote block: verbatim SSG wording in full.
3. `## What could count` — the evidence menu, three strands as `###` headings each followed by `checkListItem` blocks: **Work-based assessments (aim N)**, **Clinical and experiential evidence**, **CPD and courses**. Content: the per-KC items from the September pack (`/outputs/cesr/hillo-NN.md`), lightly edited for verbatim KC numbering. The planned / n-a lifecycle is a *convention* here (the block only has `checked`): the how-to says "strike through (Cmd/Ctrl-Shift-S) anything that doesn't apply; bold what you're pursuing this placement."
4. `### Your own routes` — one empty `checkListItem` with `fill("add an evidence route the menu doesn't list")`.
5. `## Notes and gap plan` — one paragraph `fill(…)`.
6. Divider, then `pageLink` back to the HiLLO page.

**Nothing else.** No evidence table, no supervisor callout (the supervisor's per-KC view is the properties row; their prose lives on the HiLLO summary block).

### 4.2 HiLLO page (×14)

**Title:** `HiLLO 12 — Neurosciences intensive care medicine`. `description`: the one-line HiLLO statement.

**Properties:** none seeded (the HiLLO's progress is its children).

**Body:**
1. How-to callout: "Your KCs are the sub-pages below; the list shows each one's status, sign-off and evidence count from its own page. Work in the KC pages. The summary block is your supervisor's, and appears in meeting notes."
2. `## What the curriculum asks for` — verbatim HiLLO statement (quote block), then the *At a glance* bullets from the September pack (level, placement, currency, cross-referencing).
3. `## HiLLO-level evidence` — `checkListItem`s for the placement-wide items (logbook, rota, supervisor report, CPD, reflections, letters) — these have no single KC and so live here.
4. `## Required evidence` (HiLLOs 10, 11, 13, 14 only) — the SSG's hard requirements as `checkListItem`s (300-case logbook, 12 anaesthesia SLEs, APLS/EPALS, safeguarding, etc.) in a **red** callout.
5. `## Maintenance route (>7 years)` (HiLLOs 10–14) — `checkListItem`s.
6. `## Supervisor summary` — **synced block source**, key `cesr-hillo-N-summary` (replaces `cesr-hillo-N-progress`): a green callout with `fill("Supervisor: overall view of this HiLLO, and what would make it sufficient — sign and date")` and one `checkListItem` `fill("next action agreed")`.
7. Divider, `pageLink` to HiLLOs hub.

The sub-page list (KCs) renders below the body automatically — that is the progress table.

### 4.3 Synced blocks

Fourteen `PackSynced` entries, keys `cesr-hillo-{1..14}-summary`, source = the HiLLO page. Placed:
- **HiLLOs hub:** read-only, under each HiLLO's page link.
- **Mid-placement, End-of-placement and Pre-submission meeting templates:** read-write, in the *HiLLO review* section, replacing the v3 progress tables. Keys change, so the meeting templates bump to a new version with a changelog noting the rename.

The v3 `cesr-hillo-N-progress` blocks are **not** carried forward. Since no instantiations exist, nothing is orphaned.

### 4.4 Evidence hub and evidence item pages

**Evidence hub** page: how-to ("one page per item — create it here from the Evidence item template in the gallery, fill the properties, anonymise, then link it from the KC pages it supports"), `noPhi()` callout, the storage-mode explanation (described / linked / attached), then the sub-page list does the rest. One child page seeded: **Evidence rules that apply everywhere** (the September `evidence-rules.md`, verbatim SSG cross-cutting requirements as `checkListItem`s).

**Evidence item** — a new **page template** in the gallery (`kind: "page"`, category Training & Portfolio, name "Evidence item"), not a page in the workspace template:

| id | type | label | seeded |
|---|---|---|---|
| `type` | select | Type | `fill` — convention: CBD · DOPS · Mini-CEX · ACAT · MSF · Reflection · Certificate · Logbook · Letter · Audit/QI · Teaching · Other |
| `date` | date | Date | — |
| `consultant` | text | Supervising consultant | — |
| `stored_as` | select | Stored as | convention: Described · Linked · Attached |
| `link` | link | Link | — |

Body: how-to; `noPhi()`; `## What it is` (`fill`); `## Which capabilities it evidences` — *"Link this page from the Evidence property of each KC it supports; the list appears here under Evidence for."*; `## Anonymisation check` — three `checkListItem`s (names/addresses/contacts removed; NHS and other numbers removed; colleagues' GMC numbers removed).

Design note: the relation is declared on the **KC** (forward) and the evidence page gets the reverse side automatically. The evidence page carries no relation row of its own; Appendix B §4.4 reverse rows stay deferred.

### 4.5 Start here

Rewrite for v4. Must state, in this order: what the workspace is (one line); the two contracts — *your voice is protected* (Reflections and Application narrative open supervisors in Suggest) and *drafts are private until you share them*; the **Status convention** (four values, spelled out) and who sets what (candidate: Status; supervisor: Signed off + Supervisor); the evidence loop in three sentences (create an Evidence item → link it from the KC → the KC's count and the item's "Evidence for" update); the suggested rhythm to-dos; page links.

### 4.6 My plan, Placements, Reflections, Application narrative, Resources

Carry forward from v3 with these changes only:
- **My plan:** the Milestones checklist replaces "Evidence mapped to every HiLLO, with no red gaps" with "Every KC at Ready for review or Signed off (check each HiLLO page's sub-page list)".
- **Reflections** (authored): the Reflection log table is **deleted**; reflections are sub-pages made from the Reflection page template, and the sub-page list is the log. Reflection page template gains properties `date` (date) and `kc_note` (text, label "Evidences (KC numbers)") and its changelog notes that a reflection is linked *from* KC pages like any evidence item.
- **Application narrative** (authored): unchanged except references to "Evidence index numbers" become "evidence page titles".
- **Placements, Resources:** unchanged.

### 4.7 Supervision meeting templates (×4)

- HiLLO review section: fourteen read-write embeds of the **summary** blocks (Mid, End, Pre-submission) instead of the progress tables. Initial keeps no embeds.
- Add, above the review section, a how-to line: "Before the meeting, open each HiLLO page: the sub-page list shows every KC's status and evidence count. Discuss ambers and reds; record sign-offs by setting Signed off and Supervisor on the KC page, not here."
- Version bump on each, changelog: "HiLLO review now embeds the supervisor summary blocks (keys renamed from -progress to -summary); progress is read from the KC pages' properties."

## 5. Content sources and fidelity rules

- **Verbatim wording:** HiLLO statements and all 92 KC texts come from the GMC Specialty Specific Guidance for ICM (Portfolio pathway), updated 04/02/2025 — already transcribed in `/outputs/cesr/hillo-01.md … hillo-14.md` (September pack). Copy from there; do not paraphrase; do not renumber. Numbering `N.M` is the WorkspaceICU convention; the SSG lists KCs unnumbered.
- **Evidence menus, at-a-glance, required/maintenance lists:** from the same files. Where the September file grouped KCs into subpages, ignore that grouping — v4 has one page per KC.
- **Anonymisation and PHI:** `noPhi()` on Start here, Evidence hub, every Evidence item, Reflections, Application narrative. No example content may resemble a real patient.
- **Placeholders:** use `fill()` for anything the candidate must supply; never leave v3's «paste from FICM» placeholders — v4 ships the wording.

## 6. Versioning and install

- `cesrJourney()` → `version: 4`, changelog: "One page per Key Capability with verbatim curriculum wording, Status/Signed off/Supervisor properties and an Evidence relation; evidence items are pages linked from KCs; the HiLLO page's sub-page list replaces the hand-typed progress table; supervisor summary blocks replace the synced progress tables in meetings. Evidence index page removed."
- Page keys: the build script matches by "template / parent title / title". HiLLO titles change (v3: `HiLLO 12`; v4: `HiLLO 12 — Neurosciences…`), so keys will *not* match — acceptable because there are no instantiations. Do not add key-mapping hacks.
- Supporting templates: Reflection → v3, the three meeting variants with embeds → next version each, new **Evidence item** v1. Evidence cover sheet and PDP unchanged.
- Rebuild `content/cesr-journey.snapshots.json` via the documented temp-file route; commit both.
- Install/update from the gallery's Platform packs section as the owner (existing `installPack` action). Then the owner instantiates once into a scratch workspace and checks §7.

## 7. Acceptance criteria

1. Instantiating CESR Journey v4 creates 117 pages; every KC page has the four properties with the stated ids; every HiLLO page's sub-page list shows its KCs with Status = Not started and the Evidence column empty.
2. Creating an Evidence item from the gallery under Evidence, then adding it to KC 12.8's Evidence property, shows "Evidence for: KC 12.8 — Raised intracranial pressure" on the item and "1" in the HiLLO 12 sub-page list.
3. Setting Status to "Ready for review" on a KC page changes that row in the HiLLO's sub-page list without any other edit.
4. The Mid-placement meeting template, instantiated in the same workspace, shows the fourteen supervisor summary blocks live; editing one in the meeting edits it on the HiLLO page.
5. Reflections and Application narrative open a non-author in Suggest mode.
6. Markdown export of a KC page renders its properties block including the relation both ways.
7. No page in the pack contains a `«…»` placeholder for curriculum wording; all 92 KC texts match the SSG verbatim (spot-check 12.8, 10.9, 5.11, 13.6).
8. All existing unit and e2e tests pass; the DSL extension has its own tests.

## 8. Build order

1. DSL extension + build-script changes + tests (own PR).
2. New page templates: Evidence item; Reflection v3 (own PR).
3. KC and HiLLO page generators driven by a data file `content/cesr-curriculum.ts` holding the 14 HiLLOs, 92 KCs (verbatim), short titles, at-a-glance, evidence menus, required and maintenance lists — content separated from layout so a future SSG revision is a data change (own PR, largest).
4. Remaining pages, synced summary blocks, meeting template updates, Start here rewrite, version bump, snapshot rebuild (own PR).
5. Owner installs to production gallery, instantiates a scratch workspace, walks §7.

## 9. Out of scope

Computed status or counts beyond what the app already shows; reverse relation rows (Appendix B §4.4); a Supervisor home template (next pack); cohort views; any change to the app itself beyond the pack DSL and build script. If a step seems to need an app change, stop and say so.

The parent brief's instructions apply: inspect before implementing, small reversible PRs, no PHI anywhere, confirm before committing where this document says "convention" or "proposed".
