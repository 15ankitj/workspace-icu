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
templates using the small DSL in `blocks.ts`. Curriculum-specific wording
(HiLLO descriptors, Key Capabilities) is deliberately left as
«placeholders» for the platform owner to paste from the FICM source —
nothing clinical is paraphrased here, and no patient details appear
anywhere.

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

### Synced blocks (v2)

`synced(id, readOnly)` places a synced block; the template lists the
block in `synced` with a stable `key` (e.g. `cesr-hillo-3-progress`), its
source page (or `null` when another template owns it) and seed content.
On install, a block whose source page is created gets created with the
key; a placement whose key already exists in the workspace resolves to
that block; otherwise the placement is copied as ordinary content. That
is how the meeting notes' HiLLO review tables bind to the tables the
CESR Journey pages own.

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
