# Runbook — cloud-only workflow

There is no local development environment. All work happens from Claude Code
on the web and browsers; the hosted Supabase projects are reached over the
network. See `docs/development-plan.md` for the full plan.

## Environments

| Environment | Supabase project                | Vercel                       | Applied when        |
| ----------- | ------------------------------- | ---------------------------- | ------------------- |
| Staging     | `workspaceicu-staging` (London) | Preview deployments (per PR) | While a PR is open  |
| Production  | `workspaceicu` (London)         | `main` deployments           | After the PR merges |

## Schema changes

1. Write a numbered SQL file in `supabase/migrations/` (next `NNNN_name.sql`).
   Include the rollback as a `-- rollback:` comment block at the bottom —
   a migration without a rollback is not mergeable.
2. Apply it to **staging** with the Supabase MCP `apply_migration` tool.
3. Smoke-test against the Vercel preview deployment.
4. After merge, apply the same file to **production** with `apply_migration`.
5. If it misbehaves, run the rollback block via `execute_sql` and revert the
   PR. Migrations are additive; nothing is dropped without a rollback path.

The repo is the record of the schema: never apply SQL to a hosted project
that is not committed in `supabase/migrations/`.

## Edge Functions

Committed under `supabase/functions/<name>/`, deployed with the MCP
`deploy_edge_function` tool — staging first, production after merge.

## Secrets

Service-role and provider keys live only in Supabase and Vercel settings.
Never commit them, never paste them into a Claude Code session. The app only
ever uses the anon key + the user's session; RLS is the authorisation
boundary.

## Type generation

After a migration lands, regenerate `src/lib/database.types.ts` from the
staging project (MCP `generate_typescript_types`) so the hand-maintained
types stay honest.

## Real-time collaboration (Phase 3)

Liveblocks is the Yjs transport; Supabase (`page_documents`) is the durable
store, so the provider stays disposable. The account uses Liveblocks'
**global** region (content never includes PHI by policy) — list Liveblocks
as a processor in the DPIA.

- Set `LIVEBLOCKS_SECRET_KEY` (from the Liveblocks dashboard, the project's
  secret key `sk_…`) in Vercel → Settings → Environment Variables for
  Production and Preview. It is server-only: the app only ever mints room
  tokens through `/api/liveblocks-auth`, which checks membership and page
  privacy via RLS and scopes each token to read or read-write.
- Collaboration switches itself on when the key is present; without it the
  editor runs in the Phase 2 local-only mode. No other flag is needed.
- Use separate Liveblocks projects (keys) for Preview and Production if you
  want staging rooms isolated from real ones.

## Email (Phase 5)

Invitations are sent through Resend's REST API from server actions.

- Set `RESEND_API_KEY` in Vercel (Production and Preview). Create the key in
  the Resend dashboard — never paste it into a Claude Code session.
- Sending domain: **icmworkspace.com**, verified in Resend (EU region) with
  DNS records held in Vercel → Domains. Set `RESEND_FROM` to
  `WorkspaceICU <invites@icmworkspace.com>` in Vercel (Production). Without
  it the sandbox sender `onboarding@resend.dev` is used, which **only
  delivers to the Resend account owner's own address**.
- Set `NEXT_PUBLIC_APP_URL=https://icmworkspace.com` (Production) so
  invitation links use the public origin; otherwise the request host is used.
- Without `RESEND_API_KEY`, invitations are still created and their accept
  link can be copied from workspace settings and shared by hand.

## Templates and the gallery (Phase 6)

- Any editor can save a page (or page + sub-pages) as a **workspace**
  template from the page ⋯ menu; it appears in that workspace's gallery.
- The **platform owner** (rows in `platform_owners`, seeded by email in
  migration 0010; add owners with an insert) can save **platform**
  templates and publish/deprecate them in the gallery for everyone.
- Republishing from the source page creates a new version with a changelog;
  existing copies are never modified. Pages carrying an older version show
  a banner offering "Add the new pages" (matched by `template_page_key`).
- Assets referenced by template pages are copied to the private
  `template-assets` bucket under `{template}/{version}/{file}` and copied
  again into the target workspace on instantiation.

## Export and import (Phase 7)

- **Markdown export**: page ⋯ menu → Export → Markdown (this page / with
  sub-pages); workspace settings → Download workspace export. Zips contain
  one `.md` per page in folders mirroring the tree, with attachments under
  `files/` and links rewritten relatively. Only pages the caller can see are
  included (RLS). Exports are audited.
- **PDF**: page ⋯ menu → Print / PDF opens a print-styled view that
  triggers the browser's print dialog — save as PDF from there. No
  server-side browser is involved.
- **Import**: sidebar → Import accepts `.md` and `.docx`; parsing happens in
  the browser (BlockNote's parsers; `mammoth` for Word). Embedded images go
  through the normal upload gate and advisory PHI scan; a leading H1 becomes
  the page title.

## Hardening (Phase 9)

- **Trash and purge**: deleted pages sit in the workspace Trash (sidebar)
  for 30 days with Restore / Delete permanently. The nightly job
  `/api/cron/purge` (scheduled in `vercel.json`, 03:00 UTC) removes pages,
  files and workspaces trashed more than 30 days ago, and page history
  older than 90 days. It is the **only** code path that uses the service
  role, because it works across all workspaces and serves no user. Set in
  Vercel (Production only): `SUPABASE_SERVICE_ROLE_KEY` (Supabase →
  Project settings → API keys) and `CRON_SECRET` (any long random string;
  Vercel sends it as the bearer token). Without them the job answers 503
  and nothing is purged.
- **Account deletion**: workspace settings → "Your account". Personal
  workspaces and workspaces with no other member are erased (files
  included); content in shared workspaces is reassigned to a workspace
  owner. Platform owners must hand over ownership before deleting.
  Membership removals that happen by cascade (the workspace or the user
  is being deleted) are still audited, with the workspace id in the
  event's metadata rather than as a reference (migration 0019).
- **Rate limits**: 20 invitations and 60 uploads per user per hour
  (`consume_rate_limit`, migration 0011).
- **Security headers**: `next.config.ts` sets a Content Security Policy
  whose `frame-src` is the embed whitelist (YouTube, Google Drive/Docs)
  plus our own file storage; `frame-ancestors 'none'`, `nosniff`, HSTS,
  referrer and permissions policies. Add a host there before adding a new
  embed kind.
- **Error monitoring**: set `NEXT_PUBLIC_SENTRY_DSN` (Sentry project in the
  EU data region) in Vercel to enable Sentry; PII is off and request
  bodies, cookies, headers and console breadcrumbs are stripped, so no page
  content leaves the app. Without a DSN Sentry is inert.
- **Regions**: `vercel.json` pins serverless functions to London (`lhr1`).
- **Smoke tests**: `npm run e2e` runs Playwright against a production
  build with placeholder Supabase values (health, sign-in, headers, skip
  link, auth redirect). CI runs them after the build. Editor and
  collaboration flows are tested by hand on the preview deployment.
- **Compliance drafts**: `docs/compliance/` (DPIA, privacy notice, breach
  procedure, processor DPA checklist) and the in-app `/privacy` page.

## Sign-in (magic link + one-time code)

`signInWithOtp` sends one email that carries both a link and a one-time
code, provided the Supabase email templates include both placeholders.
In **each** project (Authentication → Email Templates) add this line to
the **Magic Link** template and to **Confirm signup** (used for a
first-time address), keeping `{{ .ConfirmationURL }}`:

```
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
```

- The link completes at `/auth/confirm`; the code is verified on the
  sign-in page itself (`verifyOtp`, type `email`), which is what works
  when the email is opened on a different device or the link has been
  rewritten by a mail filter. The code length is a project setting
  (Authentication → Providers → Email → "Email OTP Length"; ours is 8) and
  the page accepts 6–10 digits; expiry 1 hour.
- Supabase allows one resend per address every 60 seconds; the page
  surfaces its message.
- **Custom SMTP is required** — Supabase only allows template editing
  (and a usable email rate) with it. Auth email goes through Resend from
  the same domain as invitations. In each project, Authentication → SMTP
  Settings: sender `sign-in@icmworkspace.com`, name `WorkspaceICU`, host
  `smtp.resend.com`, port `465`, username `resend`, password = a Resend
  API key created for that project (`supabase-auth-staging` /
  `supabase-auth-production`, sending access, restricted to the domain).
  Then Authentication → Rate Limits → emails per hour to a pilot-sized
  value (e.g. 100).
- Production URL configuration: Site URL `https://icmworkspace.com`,
  redirect URLs include `https://icmworkspace.com/**` plus the
  `*.vercel.app` entries previews use.

## Synced blocks (Appendix A, Part 1)

One identity, many placements. A synced block's content lives in its
own collaborative document (`synced_blocks.ydoc`, projection in
`synced_blocks.blocks`) synced through the Liveblocks room
`synced:{id}`; every placement, the source page's included, is an editor
block of type `syncedBlock` holding only the reference and a per-placement
`readOnly` flag. Reading or editing through any placement is governed by
the **source page**: the row is invisible to anyone who cannot see the
source page (they get a neutral placeholder), and the room token is
read-only unless they can edit the source page.

- **Create**: a block's ⋮⋮ menu → _Turn into synced block_ (the block and
  its children lift into the synced document; the page keeps a placement).
  The paste token goes on the clipboard; paste it in any page, or use
  `/synced`, to place it there. Same-page placements are allowed; nesting
  synced blocks is refused.
- **Placement chrome** appears on hover: source page link, placement
  count, read-only badge, Copy, and per-placement _Make read-only here_ /
  _Remove here_.
- **Fan-out cap**: the first 20 distinct synced sources on a page go live;
  further placements render the stored projection with a _Snapshot ·
  refresh_ affordance (`MAX_LIVE_SYNCED_SOURCES` in `src/lib/synced.ts`).
- **Search** indexes synced content once, under the source page. **Backlinks**
  from host pages to the source page are added by `set_page_links`. Edits
  through a placement write an audit event with both pages, coalesced to
  one per actor per block per five minutes.
- **Export/print** render placements as their current content plus
  "Synced from: <page>"; anything the exporter cannot load renders as
  "(synced content unavailable)", never as content.
- **Deleting** (rules 6, 7): removing a placement from a host page removes
  only that placement (_Remove here_, or delete the block). Removing the
  placement on the **source page** prompts: _Put it back_, _Delete
  everywhere_ (the block becomes a tombstone: content cleared, title and
  time kept, so remaining placements say what was lost), or _Choose a new
  source_ (a page already hosting it takes over; permissions follow it).
  Closing the prompt decides nothing: the page shows its detached sources
  in a banner until each is resolved, so nothing is orphaned silently.
- **Trash**: while the source page is in the Trash, placements show a
  "source in trash" placeholder with _Check again_; they recover on
  restore. _Delete permanently_ in the Trash prompts per synced block that
  still appears elsewhere (delete everywhere / make a host the source). A
  page removed by the nightly job takes its sources to tombstones by
  trigger (`pages_tombstone_synced_sources`, migration 0016).
- **Cleanup**: the nightly purge deletes the Liveblocks rooms of
  tombstones (`content_purged_at`) and, 30 days on, tombstone rows nothing
  places any more. It also deletes the rooms of purged pages. Room
  deletion needs `LIVEBLOCKS_SECRET_KEY` and is best effort; the token
  route refuses tombstone rooms regardless.
- **Templates** (rule 8, migration 0017): saving a template keeps a
  synced block whose source page is inside the tree (or which carries a
  `template_key`) as a keyed reference and flattens any other placement
  to a static copy, noting it in the changelog. Installing creates the
  blocks whose source pages are created, resolves other keys to the
  workspace's existing blocks, and copies unresolved placements as
  content. Platform packs bind across templates by key (the CESR
  Journey's fourteen `cesr-hillo-N-progress` tables are placed read-only
  on the HiLLOs overview and read-write in the mid- and end-of-placement
  meeting notes). The gallery offers **Update to vN** to the platform
  owner when the bundled pack is newer than the installed one.

## Suggestion mode (Appendix A, Part 2)

Suggestions are marks inside the page's collaborative document
(`insertion`, `deletion`, `modification`, from
`@handlewithcare/prosemirror-suggest-changes`), so they travel with Yjs,
history and presence. Each suggestion id starts with the suggester's
user id. `blocks` is the **clean** projection — every open suggestion
reverted — so search, export and static rendering show what the page
says until the author accepts (brief §2.4).

- **Modes**: the page header offers Edit / Suggest / View. Pages carry
  `authored_content` (page ⋯ menu → _Authorship_, authors and owners
  only) and `co_authors`. On an authored page non-authors open in
  Suggest and cannot pick Edit; anyone who can edit may choose Suggest.
  Suggesting needs collaboration (`LIVEBLOCKS_SECRET_KEY`); without it
  non-authors of authored pages get View.
- **Enforcement** (migration 0018): `replace_page_blocks` — the one save
  path — refuses a non-author's save of an authored page unless the
  canonical text and block types are unchanged. A non-author's save can
  carry the author's not-yet-persisted edits; the client retries quietly
  after a few seconds. A workspace owner who resolved a suggestion on
  the page in the last 10 minutes passes, so owner overrides apply.
- **Resolution**: authors accept or reject (popover on the caret, or the
  review bar with _Accept all_ / _Reject all_ behind a count-naming
  confirm); the suggester may withdraw. A workspace owner who is not the
  author must type a reason, stored on the suggestion and in the audit
  event as an override. The server records the outcome before the
  document applies it. Audit pair: `suggestion_created` and
  `suggestion_accepted|rejected|withdrawn` on `page_suggestions`.
- **Retention**: resolved-suggestion detail (excerpt, reason) is deleted
  by the nightly purge after 90 days; audit events stay.
- **Synced blocks** follow their source page: a block sourced from an
  authored page is read-only for non-authors in every placement until
  block-level suggestions arrive.
- **Rationale threads** (migration 0020): a suggestion's notes are
  comments with `suggestion_id` — the same comment model — shown under
  the suggestion in the review bar while it is open, and in the page's
  comments (badged "On a suggestion") once resolved. They are deleted
  with the suggestion's detail after 90 days.
- **Notifications**: triggers write `notifications` rows — a new
  suggestion to the page's authors, a resolution to the suggester, a
  reply to everyone on the thread — never to the actor, never twice
  while an identical one is unread. The sidebar shows _Updates_ with an
  unread count (opening it marks them read) and the page tree shows open
  suggestions per page. The nightly `/api/cron/digest` (07:00 UTC) sends
  one email per person for unread, not-yet-emailed rows through Resend
  (titles, names and counts only) and closes them out. Settings → Your
  account switches the digest off (`users.email_digest`).
- **Block-level suggestions**: inserting, deleting or dragging whole
  blocks in Suggest mode marks the blocks themselves (a left rule in the
  suggestion colour); a drag-move is one suggestion, "Move block". Accept
  and reject work as for inline changes.
- **Context changed** (§2.4, migration 0021): when an author's own edit
  removes the text under an open suggestion, the page reports it after a
  short grace period; the suggestion becomes `stale`, the suggester is
  notified, and the review bar lists it under "Context changed" with
  _Withdraw_ (suggester) or _Dismiss_ (author). Stale suggestions can
  never be accepted. Remote edits and page loads never trigger this.
- **Placements of authored synced blocks**: an editor who is not the
  source page's author gets Suggest mode inside the placement ("your
  edits here are suggestions"); suggestions are indexed under the source
  page, the source's authors accept or reject from the caret popover in
  any placement, and `save_synced_block` refuses a non-author's change
  to the block's clean text.
- **Exports** (§2.4, slice 4): every export is the clean state by
  default — suggested insertions left out, suggested deletions kept as the
  author's text — because the stored `blocks` projection is that state.
  _Include suggestion markup_ in the page menu switches the Markdown and
  print exports to `?markup=1`, which reads each page (and each synced
  block placed on it) from its stored Yjs document and renders
  insertions as `<ins>`, deletions as `<del>`, and a suggested block
  behind a "Suggested insertion (name):" line, with a closing list of the
  suggestions per page. Whichever variant, pages with suggestions still
  waiting are named: a notice on the print view (not printed) and an
  `EXPORT-NOTES.md` in the zip, including the whole-workspace export.
  Template snapshots read the same clean projection, so a template never
  captures an open suggestion.
- **Whole-block suggestions and Yjs**: y-prosemirror syncs node
  attributes but not node marks, so a block-level suggestion mark would
  never reach a collaborator or the stored document. The editor mirrors
  those marks into a `suggestion` attribute on every block-level node (a
  JSON string, not rendered) and restores the marks from it on documents
  that arrive from Yjs; the markup export reads the same attribute.
- Not yet: `authored_content` defaults in the CESR pack (5).
