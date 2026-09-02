# Personal data breach procedure

Applies to any confirmed or suspected loss, unauthorised access or
disclosure of personal data held by WorkspaceICU, including
patient-identifiable information found in the service in breach of the
acceptable use policy.

## 1. Detect and record (hour 0)

Sources: a user report (in-app _Report content_, email), a processor
notification (Supabase, Vercel, Liveblocks, Resend, Sentry), an audit
anomaly, or a security advisory.

Open an incident record with: time discovered, who reported it, what is
known, and the incident lead (platform owner unless delegated).

## 2. Contain (first hours)

- Compromised credentials: revoke sessions in Supabase Auth; rotate the
  affected key in Vercel/Supabase settings; rotate `LIVEBLOCKS_SECRET_KEY`,
  `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` if in doubt.
- Exposed content: remove the public link; quarantine or delete the
  content via the owner tools; purge the trash entry if needed.
- Patient-identifiable information in the service: delete it, purge it
  from the trash, note the file/page id and the uploader, and follow §4.

## 3. Assess (within 24 hours)

Record: what data, whose, how many people, how it happened, whether it is
still ongoing, and the likely consequences for the people affected.

## 4. Notify

- **ICO:** within **72 hours** of becoming aware, if the breach is likely
  to result in a risk to people's rights and freedoms. Use the ICO's
  online form. Document the reasoning if you decide not to notify.
- **Affected users:** without undue delay if the risk is high, in plain
  language, with what happened and what they should do.
- **Patient-identifiable information:** the user who added it is
  responsible under their own professional and employer obligations;
  inform them, and where the data belongs to an NHS organisation, tell
  that organisation's information governance lead so they can follow their
  own incident process.
- **Processors:** if the breach originated with a processor, keep their
  incident reference.

## 5. Review (within two weeks)

Root cause, what worked, what to change (policy wording, a control, a
test). Update the DPIA. Close the incident record.

## Contacts

| Role                        | Name | Contact |
| --------------------------- | ---- | ------- |
| Incident lead               |      |         |
| Data protection reviewer    |      |         |
| Trust IG lead (St George's) |      |         |
