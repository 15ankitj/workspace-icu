# WorkspaceICU — Development Plan (v1, cloud-only workflow)

## Context

Ankit (Consultant in Intensive Care Medicine, St George's) has written a concept brief for **WorkspaceICU**: a Notion-style, real-time collaborative workspace for doctors — pages, blocks, templates — deliberately bare at baseline, with value delivered through a curated template gallery and content packs (first: CESR Journey for Portfolio Pathway candidates and supervisors). It is explicitly **not** a clinical system and takes documented, reasonable steps to keep patient-identifiable information out.

A **revised brief (v2 of the document)** replaces the original and mandates a fully cloud-based structure: no local development environment; all work from Claude Code on the web and browsers; hosted Supabase reached over the network (MCP server / Management API); Vercel hosting. This supersedes the earlier session answer that mentioned Railway — **Vercel (EU) is the hosting target**.

This session's repo holds the existing Supervision.ICU Base44 app, which is untouched. Confirmed earlier:

- **Code location:** a new dedicated GitHub repo (`workspace-icu`); this repo only carries the plan record.
- **Collaboration transport:** **Liveblocks** (hosted Yjs provider) — verify UK/EU data residency + pricing before Phase 3.
- **Deliverable now:** plan + begin Phase 1 (foundations) build in this session.

## Decisions locked (resolving §14 of the brief)

| Decision               | Resolution                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Collaboration provider | Liveblocks (Yjs + presence + room auth). Added to the DPIA processor list                                                                 |
| Editor library         | BlockNote (Yjs-aware); fall back to TipTap direct only if custom-block constraints bite                                                   |
| Hosting                | Vercel (EU region) connected to GitHub; deploy from `main`; preview deployments per PR                                                    |
| Backend                | Two hosted Supabase projects, London region: `workspaceicu-staging` and production. RLS everywhere; no service role in user-serving paths |
| Frontend               | Next.js App Router, TypeScript, Tailwind, shadcn/ui                                                                                       |
| Email                  | Resend (magic links via Supabase SMTP config + invites)                                                                                   |
| Org model              | Create St George's organisation on day one, lightweight                                                                                   |
| Page history retention | 90 days                                                                                                                                   |
| Domain                 | Check `workspace.icu`; fall back `workspaceicu.com` (user action)                                                                         |

## Cloud-only development workflow (brief §12)

- **No local dev, no Supabase CLI.** Schema changes are written as numbered SQL migration files committed to `supabase/migrations/` in GitHub (the repo stays the record of the database), and applied to the hosted projects with the Supabase MCP `apply_migration` tool — staging first, production after the PR merges. Edge Functions are committed in-repo and deployed via MCP `deploy_edge_function`.
- **Pipeline:** GitHub (source of truth) → Claude Code on the web (changes in a cloud sandbox, opens PRs) → Vercel auto-deploys `main`, previews per PR.
- **Secrets:** service-role and provider keys live only in Supabase and Vercel environment settings — never in the repo or in Claude Code's context. Claude Code touches the database only through the Supabase MCP server.
- **Session prerequisite:** the Supabase MCP server is _not_ connected in this session. Phase 1 work that needs it (applying migrations, generating types from the live schema) is written and committed now, applied when the MCP connection + hosted projects exist. Everything else (scaffold, migrations as files, app code, unit tests, CI) proceeds regardless.
- Every migration file is written together with its rollback (additive changes only; documented down-path per the brief's reversibility rule).

## Architecture summary (per brief, unchanged)

- **Data model (§7):** `users` (profile keyed to `auth.users`), `organisations`, `organisation_members`, `workspaces`, `workspace_members`, `pages`, `blocks` (queryable projection), `page_documents` (Yjs state — source of truth for editing), `page_links`, `favourites`, `page_shares`, `comments`, `files`, `templates`, `template_versions`, `gallery_entries`, `content_reports`, `audit_events` (append-only). UUID PKs, `timestamptz`, fractional-index `position` strings, soft delete + 30-day trash/purge.
- **Authorisation:** RLS against the membership tables is the security boundary; private-page flag enforced in RLS.
- **Collaboration (§8):** one Y.Doc per page; BlockNote ↔ Yjs ↔ Liveblocks; a Supabase Edge Function verifies membership/privacy and issues the scoped room token (`page:{page_id}`); debounced persistence of the encoded Y.Doc to `page_documents` plus idempotent rebuild of the `blocks` projection; a version snapshot row per persisted save, 90-day retention.
- **Files/IG (§9):** Supabase Storage (London), signed URLs only, 25 MB cap, allowed-type list; AUP acknowledgement, upload-time reminders, advisory (never blocking) PHI scan, report/quarantine, audit events.
- **v2 guard-rail:** to-do blocks carry stable `id`, `checked`, `text`, optional `metadata` for the later lift into database rows.

## Build phases (roadmap, per brief §13)

Each phase = small, reversible PRs; feature flags where a phase touches existing users:

1. **Foundations** ← _this session, detailed below_
2. **Editor** — BlockNote with the v1 block list (§6), slash menu, markdown shortcuts, icon/cover, favourites; local-only (non-collaborative) editing first
3. **Collaboration** — Liveblocks integration, room-token Edge Function, `page_documents` persistence, `blocks` projection rebuild, presence cursors
4. **Files & IG** — upload flow, storage policies, AUP + reminders, advisory PHI scan, report/quarantine, audit events
5. **Sharing & discovery** — invites (Resend), roles, private pages, public read-only links, page comments, backlinks, @mentions, full-text search
6. **Templates & gallery** — save-as-template, snapshot/instantiate with UUID remap, versioning + update banner (`template_page_key`), gallery UI
7. **Export/import** — Markdown zip + PDF export, whole-workspace export, Markdown/.docx import
8. **CESR Journey pack** — authored in-app by the owner; pilot with 2–3 St George's candidates + supervisors
9. **Hardening** — DPIA sign-off, performance (500-block page < 1 s on a mid-range phone), accessibility (WCAG AA), account deletion, trash/purge jobs

## Phase 1 scope — built this session

Goal: a deployable skeleton where a user signs in, lands in an auto-created personal workspace, and manages a nested page tree in the sidebar.

**Repo bootstrap**

1. Create `15ankitj/workspace-icu` (private) via the GitHub MCP `create_repository`, then `add_repo` for push access; scaffold pushed to `main`, feature work on a branch with a PR.
2. Commit the development plan as `docs/development-plan.md` in the new repo; push a pointer/record to this repo's branch `claude/app-development-planning-4pkt9l`.
3. **Fallback** if new-repo creation/access is denied in-session: carry the scaffold on this repo's designated branch under `workspace-icu/`, cleanly separated, for later `git subtree split` into the real repo.

**Scaffold**

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui; ESLint + Prettier; Vitest; GitHub Actions CI (typecheck, lint, unit tests, build) so every PR is validated without any local environment.
- `supabase/migrations/` (numbered SQL files, each with its rollback) and `supabase/functions/` laid out for MCP-driven apply/deploy; a `docs/runbook.md` describing the staging → production migration flow.

**Migrations (files written now, applied via MCP when connected)**

1. `users` profile table + trigger from `auth.users`; `organisations`, `organisation_members` + RLS.
2. `workspaces`, `workspace_members` + RLS; `handle_new_user` trigger creating the personal workspace on sign-up; seed for the St George's org.
3. `pages` (parent_page_id, fractional `position`, `is_private`, soft delete, template provenance columns) + RLS deriving access from membership and the private flag.
4. `favourites`, recently-viewed tracking, `audit_events` (append-only — no UPDATE/DELETE policies) with membership events wired in.

**App**

- Supabase Auth: email magic link + Google OAuth; auth middleware; sign-in/up pages; AUP acceptance capture (`accepted_aup_version`) at sign-up.
- App shell: workspace switcher, sidebar page tree (nesting, expand/collapse, create/rename/soft-delete, drag-reorder via fractional indexing, favourites, recently viewed), breadcrumbs, page view with editable title + icon (plain body placeholder until BlockNote lands in Phase 2).
- Workspace settings: create/rename workspace; membership recorded in `workspace_members` (invite email delivery arrives with Resend in Phase 5).

**Unit tests (Vitest):** fractional-index insert/reorder/between; page-tree utilities (move validation, cycle prevention); pure-logic coverage since no database is reachable from the sandbox.

## Verification

- CI green on the PR: `typecheck`, `lint`, `test`, `next build`.
- Migrations reviewed against §7 and each paired with its rollback.
- Once you connect the Supabase MCP + create the hosted projects: apply migrations to staging via `apply_migration`, deploy to Vercel preview, then smoke-test — sign in by magic link, personal workspace auto-created, create/nest/reorder pages, and confirm a second account sees nothing (RLS check).

## User action items (outside the sandbox)

1. Create the two hosted Supabase projects in the dashboard (London): `workspaceicu-staging` + production; connect the **Supabase MCP server** to Claude Code so migrations/Edge Functions can be applied from sessions.
2. Create the Vercel project (EU) linked to `workspace-icu`; set env vars (Supabase URL + anon key per environment) in Vercel; keep service-role and provider keys only in Supabase/Vercel settings.
3. Liveblocks account — confirm UK/EU data residency + pricing (needed before Phase 3).
4. Resend account + domain verification (Phase 5).
5. Domain registrar check for `workspace.icu` (fallback `workspaceicu.com`).
6. Compliance track before first real user (§9): ICO registration, DPIA, privacy notice, DPA template, processor list (Supabase, Liveblocks, Resend, Vercel), breach procedure, limited company.
