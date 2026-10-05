# Content packs

Templates are content, not code (brief principle 3). This directory holds
the _initial_ authoring of platform packs so they can be reviewed in a PR
and reproduced; once seeded into the gallery, all further authoring
happens in the app:

1. Start from the template in a workspace.
2. Edit the pages.
3. Gallery → template → **Republish from source page** (adds a version
   with a changelog; existing copies are never changed).

## CESR Journey (brief §11)

`cesr-journey.ts` defines the workspace template and its supporting page
templates using the small DSL in `blocks.ts`. Since version 4
(`docs/cesr-journey-v4-spec.md`) the pack is a generator over data:

- `cesr-curriculum.ts` — the 14 HiLLOs and 92 Key Capabilities: verbatim
  GMC SSG statements and KC texts, at-a-glance bullets, three-strand
  evidence menus, required and maintenance lists, copied from
  `source/cesr/hillo-NN.md`. `cesr-curriculum.test.ts` compares every
  string with its source, so the data cannot drift. The only authored
  field is each KC's `shortTitle` (the page title's label).
- `cesr-evidence-rules.ts` — the cross-cutting "Evidence rules that apply
  everywhere" page, likewise verbatim from `source/cesr/evidence-rules.md`.
- `cesr-hillo-pages.ts` — the layout: a HiLLO page and one sub-page per
  KC. A KC page carries the verbatim wording as its description and first
  quote, the properties `status` (select, seeded "Not started"),
  `signed_off` (date), `supervisor` (people) and `evidence` (relation,
  reverse label "Evidence for"), and the evidence menu as `###` strands of
  to-dos. The HiLLO page's sub-page list is the progress table; nothing is
  computed.

- `cesr-hillo-guidance.ts` (v6) — St George's supervisor guidance for
  each HiLLO: what assessors look for, the minimum evidence, common
  pitfalls and which other HiLLOs the same evidence serves. It is
  guidance, not curriculum wording, so it lives apart from
  `cesr-curriculum.ts` and the source files, carries no per-HiLLO WBA
  counts (the GMC minimums stay on the Evidence rules page), and
  `hilloPage` renders it under "What assessors look for", between the
  curriculum wording and the evidence sections, behind a green callout
  that says what it is. A HiLLO with no entry fails the build.
  `cesr-hillo-guidance.test.ts` checks the shape and that no string
  reads like a WBA target or asks for an identifier.

v6 also adds a top-level **Portfolio self-assessment** page between
Start here and My plan: the baseline a candidate fills in with their
supervisor at the first meeting — placements with duration, dates, level
and the seven-year flag; exams and the Special Skills Year; an SLE tally;
cross-cutting tick-lists; supporting documents; a gap analysis whose
agreed actions are copied into My plan. It asks for no GMC number, date
of birth or patient detail.

- `cesr-anaesthesia-rotation.ts` (v7) — the St George's HiLLO 10
  tracker as data: 60 milestones, each with a stable slug id, a phase
  (Before the IAC, After the IAC, Both), a strand (Logbook, Practical
  skills, SLEs, Rota, CPD), the evidence expected, an optional one-line
  note, and the KC 10.x ids it serves. Guidance, not curriculum wording;
  no numeric targets beyond the GMC ones already on the HiLLO 10 page.
  `cesr-anaesthesia-pages.ts` is its layout: `anaesthesiaRotationTree`
  returns the 64 pages under Placements (the Anaesthesia rotation
  overview, Before the IAC, After the IAC, the HiLLO 10 bundle, and one
  page per milestone under its phase page, Both under Before) and the
  pack `relations`. Each milestone page carries `status`, `phase`, `strand` and
  `evidence_expected` selects (Status first, so the phase page's
  sub-page list shows it; it uses the KC pages' `STATUS_VALUES`,
  nothing else), an `evidence` relation (reverse
  "Rotation evidence for", so an Evidence item shows its KCs and its
  milestones as separate groups) and a `serves` relation (reverse
  "Rotation milestones", which is what the KC page shows). The pack seeds
  one Serves link per (milestone, KC); seeded links only resolve within
  one install, which is why the tree lives inside the CESR Journey
  template rather than as a separate gallery template. A milestone that
  serves a KC with no page fails the build. Sign-off stays on the KC
  page: milestones have no Signed off or Supervisor property.

No patient details appear anywhere; everything the candidate supplies is
a `fill()` placeholder. A future SSG revision is a change to the data
files, not the layout.

### Building and installing

```
npx tsx scripts/build-cesr-pack.ts > /tmp/pack.json \
  && mv /tmp/pack.json content/cesr-journey.snapshots.json \
  && npx prettier --write content/cesr-journey.snapshots.json
```

Build to a temporary file: redirecting straight onto the snapshots file
truncates it before the script has read the previous page keys, and
every page would get a fresh key (which "Add the new pages" would then
treat as new).

The snapshots file is committed and bundled with the app. The platform
owner installs a pack from the gallery ("Platform packs" section, owner
only): that creates the `templates` row (`owner_scope = 'platform'`,
published), the version with the snapshot, and the gallery entry, under
the owner's own RLS — no service role, no SQL.

### Versions

Each pack template carries a `version` and a `changelog`. Bump the
version when the content changes; the gallery then offers **Update to
vN** to the platform owner, which adds a template version (existing
copies are never modified — candidates see the update banner). The
build script keeps page keys from the committed snapshots, matched by
template name, page title and parent title, so "Add the new pages" adds
only pages that are actually new; renaming a page gives it a new key.

### Synced blocks (v2, keys renamed in v4)

`synced(id, readOnly)` places a synced block; the template lists the
block in `synced` with a stable `key` (e.g. `cesr-hillo-3-summary`), its
source page (or `null` when another template owns it) and seed content.
On install, a block whose source page is created gets created with the
key; a placement whose key already exists in the workspace resolves to
that block; otherwise the placement is copied as ordinary content. That
is how the meeting notes' HiLLO review sections bind to the supervisor
summary blocks the CESR Journey HiLLO pages own. v4 retired the v3
`cesr-hillo-N-progress` tables (progress is read from the KC pages'
properties instead); the Mid-placement, End-of-placement and
Pre-submission meeting templates embed the summary blocks read-write.

### Authored content (v3)

A pack page can carry `authored: true` (Appendix A §2.2). Its copies are
authored content: the person who starts from the template is the
creator and so the author; other editors open the page in Suggest mode
and propose changes for the author to accept or reject. The CESR Journey
marks **Reflections** and the **Application narrative** (gap statement
and the narrative for the form); the **Reflection** page template is
authored too. Meeting records, HiLLO checklists and evidence logs stay
direct-edit. The flag travels in snapshot format 3 as
`authored_content` on the page and is set by `insert_template_pages`
(migration 0022); a workspace template saved from an authored page
carries it as well.

### Page properties and relations (v4)

A pack page can carry `description` (the one-line description under the
title, at most 500 characters) and `properties`, the page-details rows
built with `prop` from `blocks.ts`:

```ts
properties: [
  prop.select("status", "Status", "Not started"),
  prop.date("signed_off", "Signed off"),
  prop.people("supervisor", "Supervisor"),
  prop.relation("evidence", "Evidence", "Evidence for"),
],
```

Ids are stable strings the author chooses, not UUIDs, so a later pack
version can find and extend the same rows; they must match the app's id
pattern (`^[A-Za-z0-9_-]{1,40}$`) and be unique on the page, or the build
fails. People and date values never travel in a template (the app clears
them on snapshot); select, text and link values do, and are the seed the
copy starts with. A `select` value is free text in the app — there is no
option list — so any convention (which values a status may take) is
stated in the page's how-to, not enforced.

A relation row declares the property; the links it holds are listed on
the template as `relations`, by authoring ids:

```ts
relations: [
  { sourcePageId: kc, propertyId: "evidence", targetPageId: item },
],
```

They travel in snapshot format 4 as key pairs (Appendix B §4.5) and are
recreated between the copies on instantiation, in declaration order per
property. A link whose pages or property row are not in the template is a
build error, not a note: a pack must never ship a dangling link.

The conversion lives in `scripts/pack-snapshot.ts` (`packToSnapshot`),
unit-tested in `scripts/pack-snapshot.test.ts`; `build-cesr-pack.ts` only
reads the previous keys and prints the JSON.
