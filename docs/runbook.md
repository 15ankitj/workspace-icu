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
