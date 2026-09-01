# Edge Functions

Supabase Edge Functions live here, one directory per function, and are
deployed to the hosted projects with the Supabase MCP `deploy_edge_function`
tool (staging first, production after merge). No CLI is used.

Planned functions (see docs/development-plan.md):

- `liveblocks-token` (Phase 3) — verifies workspace membership and page
  privacy, then issues a scoped Liveblocks room token for `page:{page_id}`.
- `phi-scan` (Phase 4) — advisory scan of uploaded files for NHS numbers
  (modulus-11), DOB patterns, hospital-number formats, and name-like strings
  near clinical terms. Advisory only, never blocking.
- `rebuild-blocks` (Phase 3) — regenerates the queryable `blocks` projection
  from a persisted Yjs document; must be idempotent.

None exist yet — Phase 1 needs no Edge Functions.
