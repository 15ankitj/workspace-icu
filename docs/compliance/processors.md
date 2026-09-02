# Processor agreements checklist

Each processor offers a standard data processing agreement that is
accepted in their dashboard or incorporated into their terms. Record the
date and where the accepted copy lives.

| Processor  | Where to accept the DPA                           | Transfer addendum needed  | Accepted on | Copy kept at |
| ---------- | ------------------------------------------------- | ------------------------- | ----------- | ------------ |
| Supabase   | Organisation settings → Legal documents           | No (London)               |             |              |
| Vercel     | Team settings → Legal / DPA                       | Yes (edge network)        |             |              |
| Liveblocks | Contact/legal page — request DPA with UK Addendum | Yes (US)                  |             |              |
| Resend     | Legal → DPA                                       | Yes (US)                  |             |              |
| Sentry     | Organisation settings → Legal & Compliance        | Yes unless EU data region |             |              |
| Google     | Google Cloud/OAuth terms (controller for sign-in) | n/a                       |             |              |

Sub-processor lists change: subscribe to each provider's sub-processor
update notifications and review yearly.

Configuration that backs the DPIA:

- Supabase projects `workspaceicu-staging` and production are in London.
- `vercel.json` pins serverless functions to London (`lhr1`).
- Sentry: create the project in the **EU data region** so the DSN host is
  `*.ingest.de.sentry.io`.
- Liveblocks: global region for the pilot; move to the UK region when
  paid usage is justified. Only page content being actively edited passes
  through it.
