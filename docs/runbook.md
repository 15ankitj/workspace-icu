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
- Optionally set `RESEND_FROM` (e.g. `WorkspaceICU <invites@workspace.icu>`)
  once a sending domain is verified in Resend. Until then the default
  sandbox sender `onboarding@resend.dev` is used, which **only delivers to
  the Resend account owner's own address** — fine for testing, not for
  inviting colleagues.
- Optionally set `NEXT_PUBLIC_APP_URL` (e.g. `https://workspace-icu.vercel.app`)
  so invitation links use a fixed origin; otherwise the request host is used.
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
