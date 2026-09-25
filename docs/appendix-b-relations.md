# WorkspaceICU — Appendix B: Relation properties

**Status:** Feature brief, 25 September 2026 — approved for build
**Parent documents:** Concept Document and Build Brief (`docs/concept-brief.md`); Appendix A (synced blocks, suggestion mode)
**Audience:** Claude Code (build agent)
**Decisions locked by the owner:** two-way by default · same workspace only · a relation to a trashed page shows as such and recovers on restore

---

## 1. Concept

A **relation** is a sixth page-property type, alongside the five in `src/lib/page-properties.ts` (people, date, select, link, text). Its value is a set of pages in the same workspace. It is **two-way**: when page A's relation "Evidence" holds page B, page B shows the same connection from its side, and either side can add or remove it.

The relation is *linking*, never *computing*. It has no rollups, formulas or derived values. The only number it produces is how many pages it holds, and that is a display detail. Status, sufficiency and the like remain properties a person sets. Nothing in this brief introduces databases; the page-properties system stays "deliberately not a database" (migration 0014's own words), and this type is designed to lift into a v2 database relation exactly as the other five are.

Motivating case: a CESR Key Capability page carries an "Evidence" relation to the evidence pages that support it; each evidence page shows "Evidence for: KC 12.7, KC 12.8". The HiLLO page's sub-page list then reads *KC · Status · Signed off · 3 evidence* with nothing typed twice. The same shape serves a QI project linking its actions, a teaching session linking its cases, an induction page linking the guidelines a starter has read, and a supervisor's candidate page linking that candidate's meeting records.

## 2. Terminology

- **Relation property** — a row of type `relation` in a page's `properties.rows`. Has an `id`, a `label` (e.g. "Evidence"), and a **name for the reverse side** (`reverse_label`, e.g. "Evidence for").
- **Link** — one (page, property, target page) connection. Stored once; visible from both pages.
- **Forward side** — the page whose property row declares the relation. **Reverse side** — the target page, which shows the link under the reverse label without needing a property row of its own.
- **Reverse row** — optional: a target page may also carry a relation row that *is* the reverse of a forward row (see §4.4), so the reverse side becomes a first-class, reorderable property rather than an implicit panel entry.

## 3. Data model

Links live in a table, not inside the jsonb, because they are queried from both ends, must survive property-row edits, and must react to page trash/restore/purge.

```sql
create table public.page_relations (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  source_page_id    uuid not null references public.pages(id) on delete cascade,
  source_property_id text not null,            -- the relation row's id on the source page
  target_page_id    uuid not null references public.pages(id) on delete cascade,
  position          text not null,             -- fractional index, order within the property
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint page_relations_distinct unique (source_page_id, source_property_id, target_page_id),
  constraint page_relations_not_self check (source_page_id <> target_page_id)
);
create index on public.page_relations (target_page_id);
create index on public.page_relations (source_page_id, source_property_id);
```

- `workspace_id` is denormalised for RLS and for the same-workspace rule; a trigger asserts that both pages belong to it (§4.2).
- The property row itself gains a shape in `page-properties.ts`:
  `{ id, type: "relation", label, reverse_label, value: never }` — the row declares the relation; the links are in `page_relations`. `normalizeProperties` keeps `reverse_label` (default: `"Related: " + label`, max 40 chars) and drops any `value` supplied.
- `pages.properties` jsonb is unchanged in storage shape; the existing `pages_properties_shape` constraint still holds.

**Why not a `value: uuid[]` in the jsonb** (like people)? Because the reverse side would need a scan of every page's jsonb to answer "who links to me", trash/restore would have to rewrite other pages' jsonb, and template instantiation would have to rewrite ids in place. The table makes all three trivial and is what a v2 database relation would use anyway.

## 4. Behaviour rules

### 4.1 Creating and editing
1. **Add property → Relation** in the page-details panel (same menu as the five existing types). The user gives it a label and, in the same dialog, the reverse label (pre-filled from the label; "Evidence" → "Evidence for").
2. The value editor is a **page picker** reusing the workspace page search already behind `@`-mentions and page-link blocks (`src/components/editor/mention-items.tsx` and the search action). Multi-select; shows icon and title; excludes the page itself, trashed pages, and pages the user cannot view.
3. Values render as **page chips** (icon + title, link to the page), in stored order, with drag-to-reorder within the property and an × per chip. A chip count is shown only when the row is collapsed or in compact layouts.
4. **Editing from the reverse side.** On the target page, the connection appears under the reverse label with the same chips and the same add/remove affordances. Adding a page from the reverse side inserts a `page_relations` row with the *other* page as source. Both sides therefore edit the same table.
5. Removing a link from either side deletes the row. Deleting the relation **property row** (from the forward page's properties) deletes all its links, after a confirm naming the count.
6. Same-workspace only: the picker only offers pages in the current workspace; the trigger in §4.2 rejects anything else.

### 4.2 Permissions
- **Read:** a link is visible to a user only if they can view **both** pages under existing page RLS (workspace membership, private-page rule, public-share rule for the page being viewed). A link to a page the viewer cannot see renders as a neutral placeholder — "A page you don't have access to" — never the title, exactly as synced blocks do (Appendix A §1.3 rule 3).
- **Write:** adding or removing a link requires **edit** rights on **both** pages (workspace editor/owner; a private page only by its owner). This is what makes two-way safe: nobody can attach their page to yours without being able to edit yours.
- RLS policies express the read rule with `exists` against `pages` via the existing `can_view_page`-style helpers; write policies check edit on both. A `before insert or update` trigger asserts both pages share `workspace_id` and neither is deleted.
- Public share view (`get_public_page`) includes relation chips only for target pages that are themselves publicly shared; otherwise the placeholder. (Keep this simple; it may be tightened later.)

### 4.3 Trash, restore, purge (owner decision 3)
- A link whose target is **trashed** (`pages.deleted_at` set) is **kept**. The chip renders as "*Title* (in trash)" muted, not clickable, with the same rule for the reverse side. No count excludes it, but the chip is visually distinct.
- **Restore** (clearing `deleted_at`) needs no action: the link was never removed.
- **Purge** (hard delete after 30 days, or from the Trash with the actor present) removes the link through the existing `on delete cascade`. Follow the synced-block precedent (migration 0016) only in one respect: when the Trash purge runs with an actor present and the page has relations, the purge confirmation names the count ("This page is linked from 4 other pages; those links will be removed").
- Trashing a page **never** deletes its links; that is the whole point of decision 3.

### 4.4 Reverse rows (optional promotion)
A target page may carry its own relation row that declares itself the reverse of a forward row, so the reverse side is a normal property (positionable, hideable) rather than an implicit panel entry. Shape: `{ id, type: "relation", label, reverse_of: { page_id?, property_id } }`. Implementation is *deferred*: ship the implicit reverse panel first (§5), and add reverse rows only if the CESR v4 pack needs the evidence page's "Evidence for" to be a hideable property. Design the jsonb shape now so it needs no migration.

### 4.5 Templates
- A relation **row** travels in the snapshot like the other rows (`propertiesForTemplate` keeps `label` and `reverse_label`).
- Relation **links** between pages inside the same snapshot travel as pairs of `template_page_key`s and are recreated on instantiation with the new page ids, in `insert_template_pages` (migration to extend it) — the same remapping the page-link blocks already get. Links to pages outside the snapshot are dropped at snapshot time and noted in the template changelog, as synced-block sources outside the snapshot are.
- Snapshot format version bumps to 4 (`src/lib/templates.ts`); older snapshots read as having no links.
- The "Add the new pages" update path adds new pages' links among themselves and to existing pages matched by key; it never removes a link the user made.

### 4.6 Export, search, backlinks, audit
- **Export (Markdown/PDF):** relation rows render as `**Label:** Title A, Title B` under the properties block; the reverse side renders as `**Reverse label:** …` on the target. Trashed targets render as `Title (in trash)`. The GMC bundle path uses the same renderer.
- **Search:** no change to indexing; relation titles are not indexed on the source page.
- **Backlinks panel:** a relation link also counts as a backlink in `backlinks-panel.tsx`, labelled with the property name, so the existing "linked from" question still has one answer.
- **Audit:** `relation.link_added` / `relation.link_removed` / `relation.property_deleted` events with source, property, target and actor; existing `audit_events` table.
- **Sub-page list** (`src/components/page/sub-pages.tsx`): show a child page's relation rows as chips (up to three, then "+N") next to the existing select/date/people meta. This is the change that produces the live "KC · status · signed-off · evidence" table for CESR without any computation.
- **Digest:** no change.

## 5. Scope and sequencing

**In scope (this iteration):** migration + RLS + triggers · `relation` type in `page-properties.ts` with tests · page-details editor with picker, chips, reorder, remove · implicit reverse panel on target pages · trash rendering · sub-page list chips · backlinks integration · export rendering · audit events · template snapshot v4 with link remapping · Playwright: two-page link, reverse visibility, trash-and-restore, permission placeholder.

**Out of scope:** reverse rows (§4.4, designed only) · rollups, counts beyond chip count, formulas, filters on relation values · cross-workspace relations · relation values in public share beyond the rule in §4.2 · relation blocks inline in the editor (relations live in properties only).

**Sequence:** (1) migration and property type, unit-tested; (2) editor and reverse panel; (3) trash/restore behaviour and permission placeholder; (4) sub-page list, backlinks, export, audit; (5) template snapshot v4; (6) e2e; (7) ship behind a feature flag defaulting on in staging, off in production until the owner has tried it.

## 6. Acceptance criteria

- Add a relation on page A to page B; page B shows the connection under the reverse label within one refresh, and removing it from B removes it from A.
- A user with view-only rights on B cannot add A→B; a user without view rights on B sees the placeholder on A and nothing about B in search or export.
- Trash B: A's chip reads "(in trash)"; restore B: chip is normal; purge B: link is gone and the audit shows `relation.link_removed` with reason `purge`.
- Instantiate a template containing two pages linked by a relation: the copies are linked to each other, not to the originals.
- The sub-page list on a parent shows each child's relation chips; export of a page with relations renders both directions.
- All existing tests pass; migration has a documented rollback; no service role in any user-serving path.

## 7. Open decisions (defaults proposed)

| Decision | Proposed |
|---|---|
| Maximum links per property | 200 |
| Chip truncation in sub-page list | 3 chips then "+N" |
| Reverse panel placement | Directly under the properties block, before Sub-pages |
| Feature flag name | `relations` |

The instructions in the parent brief apply unchanged: inspect before implementing, small reversible PRs, migration and rollback written together, confirm before committing where this document says "proposed", and no patient-identifiable data anywhere.
