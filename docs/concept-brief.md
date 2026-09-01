# Concept Document and Build Brief

## A Notion-style collaborative workspace for intensive care doctors

**Working title:** WorkspaceICU
**Author:** Ankit, Consultant in Intensive Care Medicine, St George's
**Status:** Concept, September 2026 — pre-build
**Audience:** Claude Code (build agent), future collaborators, trust IG lead

---

## 1. Purpose and positioning

A general-purpose, real-time collaborative workspace — pages, blocks, and (later) databases — built for doctors. The application is deliberately bare at baseline. Value comes from a curated **template gallery** and from **content packs** layered on top, the first of which is a CESR / Portfolio Pathway pack for ICM candidates and their supervisors.

The core product must be fully usable by someone who has nothing to do with CESR. The CESR pack is the first proof that the template system works, not the reason the product exists.

**What this is not:** a clinical record, a handover tool, a patient list, or anything that touches an EPR. It does not knowingly process patient-identifiable information (PII/PHI), and the design actively discourages users from uploading it.

**Relationship to the existing suite:** Diary.ICU (logbook/CPD), Supervision.ICU (structured supervision meetings), CESR Compass (evidence engine) and Unit Pulse (shift comms) remain separate. This app links out to them; it does not replace them in v1. The CESR Compass TypeScript sufficiency engine may be imported later as a plugin or formula function once databases exist. Nothing else is carried over — this is a fresh codebase.

---

## 2. Product principles

1. **Bare by default.** A new user sees an empty personal workspace, a "Getting started" page, and the gallery. No preloaded structure.
2. **Everything is a page or a block.** No bespoke screens for domain features. A HiLLO checklist is a page with to-do blocks; a supervision meeting is a page from a template.
3. **Templates are content, not code.** Adding a new pack (QI, induction, teaching) never requires a deploy.
4. **Collaboration is real-time from day one.** Candidate and supervisor edit the same page together; retrofitting this later is a rebuild.
5. **Privacy posture: "not intended for PHI, with reasonable steps to prevent it."** Layered nudges and advisory scanning, not a hard gate.
6. **Portable.** Accounts belong to individuals, not trusts. Export everything at any time.
7. **Multi-tenant from the start.** Organisations exist in the data model even if St George's is the only one for a year.
8. **Mobile-first reading, desktop-first authoring.** Pages must be pleasant to read on a phone in a corridor; complex editing can assume a laptop.
9. **Surgical, reversible changes.** Migrations are additive; nothing is dropped without a rollback path.

---

## 3. Layers

### Layer 1 — Core platform

Workspaces, membership and roles, page tree, block editor, real-time collaboration, search, sharing, files, export/import, templates mechanism. Knows nothing about medicine.

### Layer 2 — Template gallery

Curated by the owner only (no user publishing in v1). Browsable in-app with categories, preview, description, "who this is for", and "Start with this template". Every template opens with a short how-to-use callout at the top. Three template sizes:

| Size               | What it copies                                 | Example                              |
| ------------------ | ---------------------------------------------- | ------------------------------------ |
| Page template      | One page and its child blocks                  | Supervision meeting note             |
| Tree template      | A page and all descendant pages                | A single HiLLO with its KC sub-pages |
| Workspace template | A whole page tree intended to seed a workspace | "CESR Journey"                       |

(Database templates and row templates arrive in v2 alongside databases.)

### Layer 3 — Content packs

Workspace templates plus supporting page/tree templates, authored in the app itself by the owner and published to the gallery. First pack: **CESR Journey** (section 11). Future packs are added the same way: QI project, unit induction, teaching library, journal club, organ-donation regional resources.

---

## 4. Roles and permissions

### Organisation level (multi-tenancy)

- **Organisation** — e.g. St George's University Hospitals. Optional; individuals can exist without one.
- **Org admin** — manages org membership and org-scoped gallery entries. Cannot read members' private workspaces.

### Workspace level

| Role               | Can                                                                        |
| ------------------ | -------------------------------------------------------------------------- |
| Owner              | Everything, including delete workspace, manage members, transfer ownership |
| Editor             | Create/edit/delete pages and blocks, upload files, comment                 |
| Commenter _(v1.1)_ | Read and comment only                                                      |
| Viewer             | Read only                                                                  |

A personal workspace is a workspace with exactly one member (the owner). Workspace roles are sufficient for v1's primary sharing case — candidate (owner) + supervisor (editor or viewer).

### Page level (v1 minimum)

- Inherit workspace role by default.
- **Private page** flag: only the creator can see it, regardless of workspace role. Needed so a candidate can keep drafts and personal notes inside a shared workspace.
- **Public read-only link** per page, revocable.
- Full per-page permission overrides (share a page with a named user at a different role) — v1.1.

### Platform level

- **Platform owner** (Ankit) — curates the gallery, manages organisations, handles content reports. Has no read access to user content except via a logged, reason-recorded support action.

---

## 5. Scope

### v1 — in scope

- Sign-up / sign-in (email magic link and Google; NHS.net email allowed but not required)
- Personal workspace created on sign-up; create additional workspaces; invite members by email; roles as above
- Page tree with sidebar, nesting, drag-reorder, favourites, recently viewed
- Page icon, cover, title; full-width toggle; small-text toggle
- Block editor with the v1 block list (section 6), slash menu, markdown shortcuts, drag handle, nested blocks, keyboard navigation
- Real-time co-editing with presence cursors (section 8)
- Comments on pages (page-level discussion thread); inline block comments in v1.1
- Backlinks panel
- @mention users and pages
- Full-text search across all workspaces the user belongs to
- File and image upload with the IG nudges in section 9
- Templates: save page or tree as template (workspace-private); start from gallery template; template versioning (section 10)
- Gallery, curated, with categories and previews
- Export: page or tree as Markdown (zip) and PDF; whole-workspace Markdown export
- Import: Markdown files; .docx (text, headings, lists, tables, images — best effort)
- Audit log of membership, sharing, template, and file events
- Account deletion with full data erasure

### v1 — explicitly out of scope

- Databases, properties, views, relations, rollups, formulas (v2)
- User publishing to the gallery
- Page-level granular permission overrides beyond "private" and "public link"
- Offline editing (Yjs makes this feasible later; not a v1 target)
- Native mobile apps (responsive web only)
- Integrations with Diary.ICU / Supervision.ICU beyond hyperlinks
- Any sufficiency/RAG engine
- Payments

### v2 preview (to inform v1 design, not to build)

Databases with properties and views; row templates; rollups and formulas; inline databases embedded in pages; CESR pack rebuilt on databases with computed completion; optional import of the CESR Compass engine; user-submitted templates with moderation; commenter role and inline comments.

**Design constraint from v2:** a to-do block in v1 must be convertible to a database row in v2 without data loss. Store to-do blocks with a stable `id`, `checked`, `text`, and optional `metadata` JSON so a later migration can lift them.

---

## 6. Block list (v1)

All blocks share: `id`, `type`, `parent_id`, `page_id`, `position` (fractional index), `content` (JSON), `created_by`, `updated_at`.

| Block             | Notes                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Paragraph         | Rich text: bold, italic, underline, strikethrough, inline code, link, colour, highlight, @mention |
| Heading 1 / 2 / 3 | Feed the page table of contents                                                                   |
| Bulleted list     | Nestable                                                                                          |
| Numbered list     | Nestable                                                                                          |
| To-do             | Checkbox; nestable; see v2 constraint above                                                       |
| Toggle            | Collapsible; can contain any block                                                                |
| Callout           | Icon + colour + child blocks                                                                      |
| Quote             |                                                                                                   |
| Divider           |                                                                                                   |
| Code              | Language tag, copy button                                                                         |
| Table             | Simple grid, not a database; header row option                                                    |
| Image             | Upload or URL; caption; width                                                                     |
| File              | Upload; shows name, size, type; download                                                          |
| Link / bookmark   | URL with fetched title/description where available                                                |
| Page link         | Inline reference to another page; renders title and icon                                          |
| Embed             | Whitelisted iframes only (YouTube, Google Drive viewer, PDF)                                      |
| Table of contents | Auto-generated from headings                                                                      |
| Columns           | Two to four column container                                                                      |

**Editor library recommendation:** BlockNote (ProseMirror/TipTap-based, Notion-like out of the box, Yjs-aware). Custom blocks (callout variants, page link, file with IG banner) are implemented as BlockNote custom block specs. If BlockNote's constraints bite, fall back to TipTap directly with the same Yjs binding.

---

## 7. Data model

Postgres (Supabase, London region). Row-level security is the authorisation boundary; every table has RLS enabled and policies written against the membership tables. Never rely on the service role in application code paths that serve end users.

### Core tables

```
users                 id, email, display_name, avatar_url, gmc_number (optional, self-declared),
                      accepted_terms_at, accepted_aup_version, created_at

organisations         id, name, slug, type (nhs_trust | deanery | other), created_at

organisation_members  organisation_id, user_id, role (admin | member), joined_at

workspaces            id, name, icon, organisation_id (nullable), is_personal (bool),
                      created_by, created_at, deleted_at

workspace_members     workspace_id, user_id, role (owner | editor | commenter | viewer),
                      invited_by, joined_at

pages                 id, workspace_id, parent_page_id (nullable), title, icon, cover_url,
                      position (text, fractional index), is_private (bool), created_by,
                      full_width (bool), small_text (bool), created_at, updated_at, deleted_at,
                      template_id (nullable — provenance), template_version (nullable)

blocks                id, page_id, parent_block_id (nullable), type, position (text),
                      content (jsonb), created_by, created_at, updated_at

page_documents        page_id, ydoc (bytea — persisted Yjs state), updated_at
                      -- canonical collaborative state; `blocks` is a derived, queryable
                      -- projection updated on debounced save (see section 8)

page_links            source_page_id, target_page_id   -- for backlinks

favourites            user_id, page_id, position

page_shares           page_id, public_token (nullable), public_enabled (bool), created_by
                      -- v1.1 adds: user_id, role for per-page overrides

comments              id, page_id, block_id (nullable, v1.1), author_id, body (jsonb),
                      resolved (bool), created_at

files                 id, workspace_id, page_id, uploader_id, storage_path, filename, mime,
                      size_bytes, phi_scan_status (not_scanned | clear | flagged | overridden),
                      phi_scan_findings (jsonb), aup_acknowledged (bool), created_at, deleted_at

templates             id, owner_scope (platform | workspace), workspace_id (nullable),
                      name, description, category, audience, kind (page | tree | workspace),
                      current_version_id, is_published (bool), created_by, created_at

template_versions     id, template_id, version (int), snapshot (jsonb — page tree + blocks + files
                      manifest), changelog, created_at

gallery_entries       template_id, category, sort_order, hero_image_url, organisation_id (nullable
                      — org-scoped entries), published_at

content_reports       id, reporter_id, page_id, file_id (nullable), reason, status, created_at

audit_events          id, actor_id, workspace_id (nullable), event_type, target_type, target_id,
                      metadata (jsonb), created_at   -- append-only; no UPDATE/DELETE policy
```

### Notes

- `position` uses fractional indexing (string keys) to allow reordering without renumbering siblings.
- Soft delete (`deleted_at`) on workspaces, pages, and files with a 30-day trash and permanent purge job.
- `blocks` is a projection for search, export, and backlinks. The Yjs document is the source of truth for editing. Rebuilding `blocks` from `ydoc` must be idempotent.
- Search: Postgres full-text on `pages.title` and a flattened text column derived from `blocks`; upgrade to pgvector semantic search in v2.
- All identifiers are UUIDs. All timestamps are `timestamptz`.

---

## 8. Collaboration architecture

**CRDT:** Yjs. One Y.Doc per page. The editor binds to the Y.Doc via BlockNote's collaboration extension. Awareness protocol carries presence (cursor, selection, user colour, display name).

**Transport (decision with recommendation):**

- _Option A (recommended):_ a hosted Yjs provider — Liveblocks or Tiptap Cloud. No servers to run, matches the cloud-only workflow, presence and history come included. Costs: a second processor in the DPIA, per-user pricing.
- _Option B:_ self-hosted Hocuspocus (Node) on a small managed host (Fly.io, Railway), authenticated with a short-lived Supabase JWT. More control, one more thing to operate.
- Supabase Realtime is _not_ used as the Yjs transport; it is used for lightweight notifications (page created, member joined, comment added).

**Persistence:** the provider webhook or a debounced client save (every 2–5 s of inactivity, and on page blur) writes the encoded Y.Doc to `page_documents.ydoc` and triggers a server function that regenerates the `blocks` projection. Supabase remains the durable store; the provider is disposable and replaceable.

**Authorisation:** before the provider issues a room token, a Supabase Edge Function verifies workspace membership and page privacy for the requesting user and returns a scoped token (`read` or `read-write`). Room names are `page:{page_id}`.

**Conflict and history:** Yjs handles merge. Page history (restore a previous version) is v1.1; snapshots are cheap once `page_documents` exists, so store a version row on each persisted save from day one, prune to a sensible retention.

**Offline:** not a v1 target, but Yjs's local persistence (y-indexeddb) can be enabled later without architectural change.

---

## 9. Files and information-governance stance

**Posture:** the platform is not intended to process patient-identifiable information. The owner (as data controller) takes reasonable, documented steps to prevent users from uploading it. This is the "workspace tool" posture used by general document platforms in NHS settings, not the "clinical system" posture.

**Storage:** Supabase Storage, London region, one bucket per workspace, paths `{workspace_id}/{page_id}/{file_id}`. Signed URLs only; no public buckets. Encryption at rest is default. Maximum file size 25 MB in v1. Allowed types: images, PDF, Office documents, plain text, CSV.

**Layered nudges (all required for v1):**

1. **Acceptable-use acknowledgement** at sign-up and on first upload per user: a short plain-English statement that this is not a clinical record and patient-identifiable information must not be uploaded. Store `accepted_aup_version`.
2. **Upload-time reminder** on every file drop, with a one-click link to anonymisation guidance. Checkbox confirmation for a user's first five uploads, then an inline reminder only.
3. **Advisory PHI scan** on upload (Edge Function): pattern checks for NHS numbers (10 digits with modulus-11 check), date-of-birth patterns, hospital-number formats, and name-like strings near clinical terms in extractable text. Findings shown to the uploader with "Remove file" / "Anonymise and re-upload" / "I confirm this is anonymised" (records `overridden`). Advisory, never blocking.
4. **Report content** action on any page or file, routed to the platform owner; owner can quarantine and delete with an audit event.
5. **Terms** make the uploader responsible for content; the DPIA records mitigations 1–4.

**Compliance actions before first real user:** ICO registration; DPIA; privacy notice; data-processing agreement template for organisations; processor list (Supabase, collaboration provider, email provider); breach procedure. Operate through a limited company.

**Retention:** files follow their page (soft delete, 30-day trash, purge). Account deletion purges all owned personal-workspace content; content in shared workspaces owned by others is reassigned, not deleted.

---

## 10. Template system and versioning

**Creation:** any page (or page plus descendants) can be saved as a template. Workspace-scoped templates are visible only in that workspace. Platform-scoped templates are created by the owner and appear in the gallery.

**Snapshot format:** `template_versions.snapshot` is a self-contained JSON tree: pages (with relative structure), blocks (with content), and a files manifest (copies of template assets stored under a `templates/{template_id}/{version}` path). Internal page links are rewritten as relative references so they resolve after instantiation.

**Instantiation ("Start with this template"):** deep copy into the target workspace with new UUIDs, page links remapped, files copied, `template_id` and `template_version` recorded on each created page for provenance.

**Versioning:**

- Each edit-and-republish creates a new `template_versions` row with an incrementing `version` and a changelog.
- Instantiated pages are never modified by a template update — users own their copies.
- Pages carrying an older `template_version` show an unobtrusive banner: "A newer version of this template is available — view changes / add the new pages / dismiss." "Add the new pages" instantiates only pages present in the new version and absent in the user's tree, matched by a stable `template_page_key` stored on each template page. Diffing within a page is out of scope.
- Deprecating a template hides it from the gallery without affecting existing copies.

**Gallery metadata:** category (e.g. Training & Portfolio, Supervision, Quality Improvement, Teaching, Personal), audience, one-line purpose, longer description, preview (rendered read-only), hero image, "how to use" callout that also lives inside the template.

---

## 11. CESR Journey — first content pack (v1, pages only)

Authored in the app by the owner after the platform exists; listed here so v1 blocks and templates are validated against a real pack.

```
CESR Journey (workspace template)
├── Start here — how to use this workspace, what to share with your supervisor
├── My plan — target submission date, placements, milestones (to-do blocks)
├── HiLLOs
│   ├── HiLLO 1 …
│   ├── …
│   └── HiLLO 14
│       Each: what the curriculum asks for · what good evidence looks like ·
│             KC checklist (to-do blocks) · My evidence (describe / link / attach) ·
│             Supervisor comments (callout) · Gaps and next actions
├── Supervision meetings — one page per meeting from page templates:
│       Initial · Mid-placement · End-of-placement · Pre-submission
├── Placements — PICU and Neuro ICU guidance pages seeded from existing documents
├── Reflections — quick-capture page with a reflection template
├── Evidence index — a simple table block listing evidence items (becomes a database in v2)
└── Resources — GMC and FICM guidance links, FAQs, what assessors look for
```

Supporting page templates published alongside: Supervision meeting note (four variants), Reflection, Evidence cover sheet, PDP.

**What v1 pages give you:** every KC tickable, every meeting documented in a shared page with the supervisor editing live, all evidence described or attached in context. **What waits for v2:** computed completion, the RAG map, cohort dashboards.

---

## 12. Technology and non-functional requirements

- **Frontend:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui; BlockNote editor; Yjs.
- **Backend:** Supabase hosted project (Postgres, Auth, Storage, Edge Functions, Realtime for notifications), London region. Row-level security everywhere.
- **No local development environment.** All work happens from Claude Code on the web and browsers. The Supabase project is managed through the hosted dashboard and reached over the network like any other API: the Supabase MCP server (or Management API) for schema changes and inspection, the JS client from Vercel for application traffic. Schema changes are still written as numbered SQL migration files committed to GitHub (`supabase/migrations/`) and applied to the hosted project via the MCP `apply_migration` tool, so the repo remains the record of what the database looks like even though the CLI is never run locally. Edge Functions are deployed the same way (MCP `deploy_edge_function`).
- **Secrets:** service-role key and provider keys live only in Supabase and Vercel environment settings, never in the repo or in Claude Code's context.
- **Collaboration provider:** per section 8 decision.
- **Email:** transactional provider for magic links and invites (Resend or Postmark).
- **Hosting:** Vercel (EU region) connected to GitHub. Source of truth: GitHub. Deploy from `main`; preview deployments per PR. Database changes are tested against a second hosted Supabase project (`workspaceicu-staging`) before being applied to production; Supabase's dashboard-driven branching can replace this once stable.
- **Testing:** Vitest for units (positioning, template instantiation, PHI patterns, projection rebuild), Playwright for editor and collaboration smoke tests (two browsers editing one page).
- **Performance:** pages with 500 blocks render in under 1 s on a mid-range phone; presence latency under 300 ms; search under 500 ms for a 10,000-page workspace.
- **Accessibility:** keyboard-navigable editor, WCAG AA contrast, screen-reader labels on block controls.
- **Observability:** error tracking (Sentry), structured logs on Edge Functions, no page content in logs.
- **Security:** no service-role key in the client; signed URLs for all files; rate limits on invites and uploads; CSP with the embed whitelist.

---

## 13. Build order

1. **Foundations** — GitHub repo, two hosted Supabase projects (staging, production) created in the dashboard and connected to Claude Code via MCP, Vercel project linked to the repo, auth, organisations/workspaces/membership with RLS, personal workspace on sign-up, sidebar page tree.
2. **Editor** — BlockNote with the v1 block list, slash menu, markdown shortcuts, page icon/cover, favourites. Local-only editing first.
3. **Collaboration** — Yjs binding, provider integration, room token function, persistence to `page_documents`, `blocks` projection, presence.
4. **Files and IG** — upload, storage policy, AUP acknowledgement, upload reminder, advisory scan, report/quarantine, audit events.
5. **Sharing and discovery** — invites, roles, private pages, public links, comments, backlinks, search.
6. **Templates and gallery** — save as template, snapshot/instantiate, versioning and update banner, gallery UI.
7. **Export/import** — Markdown, PDF, .docx import.
8. **CESR Journey pack** — authored in-app; validates 2–6. Pilot with two or three St George's candidates and their supervisors.
9. **Hardening** — DPIA sign-off, performance pass, accessibility pass, account deletion, trash/purge jobs.

Each step ships behind a feature flag where it touches existing users; every migration is additive with a documented rollback.

---

## 14. Open decisions

| Decision                     | Options                                                                 | Leaning                                          |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| Collaboration provider       | Liveblocks / Tiptap Cloud / self-hosted Hocuspocus                      | Hosted; confirm pricing and UK/EU data residency |
| Editor library               | BlockNote / TipTap direct                                               | BlockNote unless custom-block constraints bite   |
| Domain for WorkspaceICU      | workspace.icu if available                                              | Check registrar; fall back to workspaceicu.com   |
| Organisation model at launch | Create St George's org on day one / individuals only until second trust | Create it, keep it lightweight                   |
| Pricing                      | Free / org licence / individual subscription                            | Undecided; keep both account paths open          |
| Page history retention       | 30 days / 90 days / unlimited on paid                                   | 90 days                                          |

---

## Instructions to the build agent

- Read this document fully before proposing an architecture. Where it says "recommended" or "leaning", propose but confirm before committing.
- Do not add domain features to the core. If something feels CESR-specific, it belongs in a template.
- Inspect before implementing; prefer small, reversible PRs; write the migration and its rollback together.
- No patient-identifiable data in fixtures, tests, seeds, or logs — ever.
- Keep the v2 database model in mind when shaping the block schema, but do not build any of it.
