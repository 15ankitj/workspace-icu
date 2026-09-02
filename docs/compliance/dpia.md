# Data Protection Impact Assessment — WorkspaceICU

**Status:** draft for sign-off · **Owner:** platform owner (data controller)
· **Version:** 0.1 (Phase 9)

## 1. What the processing is

WorkspaceICU is a collaborative document workspace for intensive care
doctors: pages, blocks, templates, comments and file attachments, shared
within workspaces the user creates. It supports education, supervision
and portfolio preparation (first content pack: CESR Journey).

It is **not a clinical system and holds no patient records.** The
acceptable use policy prohibits patient-identifiable information; the
product design assumes some users will nevertheless be tempted to paste
it, and the controls in §5 exist for that reason.

## 2. Data subjects and data

| Data subject                         | Personal data                                                                                                                        | Source                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Users (doctors, supervisors)         | Email, display name, avatar (from Google if used), sign-in timestamps, workspace memberships and roles, AUP acceptance, audit events | The user; Google OAuth      |
| Users                                | Content they write: pages, comments, uploaded files. May contain reflective writing about their own practice and about colleagues    | The user                    |
| Colleagues named in content          | Names and roles as written by users (e.g. "my supervisor Dr X")                                                                      | Users                       |
| Patients (prohibited, residual risk) | Should be **none**. Residual risk that a user pastes identifiable case detail despite the policy                                     | Users, in breach of the AUP |
| Invitees                             | Email address, invited role, inviter, expiry                                                                                         | The inviting user           |

Special category data: none is sought. Reflective writing about a user's
own health or a colleague's could in principle appear; it is user-authored
free text under the user's control and is not processed for any purpose
other than storage and display to those the user shares it with.

## 3. Purposes and lawful basis

| Purpose                                      | Lawful basis (UK GDPR Art. 6)                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Providing the service the user signed up for | 6(1)(b) contract                                                                      |
| Security, abuse prevention, audit trail      | 6(1)(f) legitimate interests                                                          |
| Sending invitations and sign-in links        | 6(1)(b) contract (sign-in); 6(1)(f) (invitations, at the request of an existing user) |
| Error monitoring                             | 6(1)(f) legitimate interests, with content excluded (see §5)                          |

No profiling, no automated decision-making, no marketing, no sale of data.

## 4. Processors and transfers

| Processor  | Role                                                       | Data                                                          | Location                                                         | Transfer mechanism                              |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Supabase   | Database, auth, file storage                               | Everything in §2                                              | London (eu-west-2) — both projects                               | UK processing; DPA                              |
| Vercel     | Hosting, serverless functions                              | Requests, logs (no content logged), env config                | Functions pinned to London (`lhr1`); edge network global         | DPA + SCCs/UK Addendum for edge                 |
| Liveblocks | Real-time collaboration transport and state                | Live page content while editing, presence (name), room tokens | Global (US-based) — chosen over the paid UK region at this stage | DPA + SCCs/UK Addendum. **Review before scale** |
| Resend     | Transactional email (sign-in links and codes, invitations) | Recipient email, inviter name, workspace name                 | US company; sending domain icmworkspace.com in the EU region     | DPA + SCCs/UK Addendum                          |
| Sentry     | Error monitoring (when a DSN is set)                       | Stack traces, URL path, user id; **no content, no PII**       | EU or US depending on the DSN region chosen — choose EU          | DPA                                             |
| Google     | OAuth sign-in (when enabled)                               | Email, name, avatar                                           | Google's terms                                                   | Google as independent controller for sign-in    |

Checklist of DPAs to accept is in [processors.md](./processors.md).

## 5. Risks and controls

| Risk                                                       | Likelihood | Impact | Controls in place                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A user uploads or writes patient-identifiable information  | Medium     | High   | AUP at sign-up and at first uploads; per-upload reminder; advisory PHI scan on text-extractable files with "confirm anonymised" override recorded; report/quarantine route for any member; audit events; anonymisation guidance page; no-PHI callouts throughout the CESR pack; 30-day trash then purge; ability for the owner to remove content |
| Unauthorised access to another user's workspace            | Low        | High   | Row-level security on every table with membership as the boundary; private pages enforced in RLS; signed file URLs only; room tokens per page issued only to members; no service role in user-serving code                                                                                                                                       |
| Content leaks through a public link                        | Low        | Medium | Public links are opt-in per page, revocable, read-only, non-indexed, and carry the page only (no files by default beyond signed access)                                                                                                                                                                                                          |
| Content ends up in logs or error reports                   | Low        | Medium | No page content is logged; Sentry configured with PII off, request bodies/cookies/headers stripped, console breadcrumbs dropped                                                                                                                                                                                                                  |
| Real-time content transits a non-UK processor (Liveblocks) | Certain    | Medium | Only page content the user is actively editing; membership verified before a token is issued; DPA + transfer addendum; UK region available as a paid upgrade when volume justifies it                                                                                                                                                            |
| A user cannot get their data out or delete it              | Low        | Medium | Markdown/zip export per page and per workspace; account deletion with full erasure of personal content and reassignment of shared content; trash and purge on a 30-day cycle                                                                                                                                                                     |
| Loss of data                                               | Low        | Medium | Supabase daily backups (verify plan tier); page history for 90 days; staging/production separation with migrations applied staging-first                                                                                                                                                                                                         |
| Abuse: invitation spam, upload floods                      | Low        | Low    | Rate limits (20 invitations/hour, 60 uploads/hour per user); 25 MB and MIME allow-list on uploads                                                                                                                                                                                                                                                |
| Cross-site scripting / framing                             | Low        | High   | Content Security Policy with embed whitelist; `frame-ancestors 'none'`; no SVG uploads; bookmark and embed URLs validated; React escaping                                                                                                                                                                                                        |

## 6. Rights of data subjects

- **Access / portability:** self-service export (Markdown + attachments).
- **Rectification:** users edit their own content and profile.
- **Erasure:** self-service account deletion; owner can delete content
  reported by members; purge after 30 days.
- **Objection / restriction:** contact the controller (privacy notice).
- Colleagues or patients named in content who are not users: handled by
  the controller on request, using the report route and owner tools.

## 7. Retention

| Data                   | Retention                                              |
| ---------------------- | ------------------------------------------------------ |
| Pages, files           | Until deleted by a user; 30 days in trash; then purged |
| Page edit history      | 90 days rolling                                        |
| Audit events           | 12 months (review), then prune                         |
| Invitations            | 7 days unless accepted                                 |
| Account                | Until the user deletes it                              |
| Error reports (Sentry) | Sentry default (90 days) or less                       |

## 8. Consultation

Pilot users (2–3 candidates and their supervisors at St George's) are the
first consultation; their feedback on the AUP wording and the upload
reminders is recorded here before the wider launch.

## 9. Sign-off

| Role                        | Name | Date | Outcome |
| --------------------------- | ---- | ---- | ------- |
| Controller (platform owner) |      |      |         |
| Data protection reviewer    |      |      |         |
