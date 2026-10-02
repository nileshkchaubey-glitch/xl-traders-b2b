# Business settings key/value repair

Verified current defect: maybeSingle was already present, so the historical
single→maybeSingle request was superseded. Production actually has id/key/value/
updated_at, a unique key index and seven existing contact/business keys. The
editor instead selected one wide row, upserted nonexistent columns on id and
reported localStorage success after errors. No storefront code reads that local
fallback or business_settings for contact routing. Live schema/policies/keys were
inspected; no production values, accounts or records were modified.

The existing editor now uses a service and the actual company_name/address/email/
phone/whatsapp/tagline/working_hours records. It reads explicit key/value columns,
preserves unknown rows, leaves missing values blank and saves changed keys only
on the current unique key. Returned key/value pairs must verify the intended
save. Load failure prevents editing until retry. Save failure preserves edits and
shows an error; no fake local save or fabricated defaults. Old localStorage is
ignored. The form clearly distinguishes these records from deployment contact
links and Site Content copy. No new customer-facing contact destination, business
claim, pricing/minimum/order rule, grant, policy or migration is introduced.

Validation on Node 20.20.2:

- npm run ci passed: 283 application tests, 41 authorization, 12 minimum-order
  and 13 reconfirmation assertions; TypeScript, guardrails, build/PWA.
- Ten settings-service regressions cover multiple/empty rows, denied reads,
  exact changed-key writes/response validation, no-op saves, denied writes and
  unsupported key rejection. Existing role tests keep customer writes denied and
  admin settings management allowed on disposable PostgreSQL.
- Actual Chrome at 390×844 and 1440×900 exercised the real form/service with
  synthetic database responses: denied load blocked edit, retry loaded existing
  rows, real Tab moved company→address, denied save kept edits, verified success
  sent only one changed key, reload round-tripped it, empty rows stayed blank and
  stale localStorage never populated the form. Zero hosted requests, page errors
  or overflow. These are fixtures, not a hosted admin-write claim.

Hosted admin settings save remains NOT TESTED without valid test access. All
production settings/contact/order/catalogue data and RLS remain unchanged.
Deployment is code-only after required CI; verify exact main/Pages. Rollback by
reverting this focused code change preserves stored key/value rows, but the old
editor mismatch returns; prefer disabling the editor or a forward repair rather
than presenting unsuccessful saves as success. Do not delete settings records.
