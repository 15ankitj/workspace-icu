# WorkspaceICU

A Notion-style, real-time collaborative workspace for intensive care
doctors — pages, blocks, and a curated template gallery, deliberately bare
at baseline. **Not a clinical record**: the platform is not intended to
process patient-identifiable information and takes documented steps to keep
it out (see `docs/concept-brief.md` §9).

- `docs/concept-brief.md` — the product concept and build brief
- `docs/development-plan.md` — the agreed v1 plan and build phases
- `docs/runbook.md` — cloud-only workflow: migrations, deploys, secrets

## Stack

Next.js (App Router, TypeScript, Tailwind, shadcn-style components) ·
Supabase (Postgres + RLS, Auth, Storage, Edge Functions — London) ·
Liveblocks + Yjs + BlockNote (from Phase 3) · Vercel (EU) · Resend.

## Development

There is **no local development environment**. Work happens from Claude
Code on the web; GitHub is the source of truth; Vercel builds previews per
PR and deploys `main`; schema changes are applied to the hosted Supabase
projects via the Supabase MCP server (see the runbook).

CI runs `typecheck`, `lint`, `test` (Vitest) and `build` on every PR.

## Status

Phases 1–4 are in: auth (magic link + Google), workspaces and membership
with RLS, the sidebar page tree, the BlockNote editor with the v1 block
list (bar columns), covers and @mentions, file uploads with the IG nudges
and advisory PHI scan, and real-time collaboration via Liveblocks + Yjs
with presence cursors (Phase 3; switches on when `LIVEBLOCKS_SECRET_KEY`
is configured — see the runbook). Next: Phase 5, sharing and discovery.
