# Deployment and verification

Cloudflare Pages is the primary observed production deployment at
https://xl-traders-b2b.pages.dev. GitHub main/PR checks show immutable Pages URLs
for exact commits; Vercel checks also run. No hosting configuration is changed
here and no paid infrastructure is required.

Repository facts: `.nvmrc` and `.node-version` specify 20, Vite outputs
`dist/public`, package-lock is npm v3, and the build command is `npm run build`.
Use `npm ci` for a reproducible install. Historical dashboard settings said
`npm install && npm run build`; current dashboard build settings have not been
read in this run, so that value is not claimed as freshly verified.

`.github/workflows/ci.yml` runs on PRs and pushes to main: npm ci, TypeScript,
storefront checks, application tests, authorization/minimum/reconfirmation
tests, and build. The `Type-check & build` status is required by main protection,
with strict checks/admin enforcement and no force push/deletion (verified 2 Oct).
Inspect actual run/check results; opening a PR is not a passing check.

Client build configuration requires the public Supabase URL/key. Never configure
private AI or service-role keys as VITE variables. Admin flags come from trusted
database provisioning, not browser deployment emails. See TEST_ADMIN.

Smart Paste is local text extraction only; browser AI generation is disabled.
An Anthropic secret-format value was verified in the predecessor #210 deployment.
The owner confirmed key revocation and private VITE hosting-variable removal on
2 October. Removing code alone cannot invalidate historical assets or installed
SWs. Independent provider-console/activity review was not performed by this agent.
See the dated browser-AI report; never restore the exposed browser-AI predecessor.

`client/public/_redirects` provides the SPA fallback. `_headers` sets frame,
content-type/referrer headers and immutable asset caching. They are copied into
the build output. Do not assert a CSP exists: the current file does not set one.

The PWA precaches the built shell/assets. `vite.config.ts` uses index.html as
navigation fallback, excludes admin and file-extension navigations, cleans old
caches, and configures no Supabase/API runtime caching. PWA is disabled in dev.
Do not put the large standalone design prototype in client/public: it would
ship and exceed the precache limit.

After each authorized merge, fetch main, confirm its SHA/run and Cloudflare check,
then test that immutable URL. For storefront changes test mobile and desktop,
deep navigation, guest privacy and the affected interaction. For auth/SQL changes
also verify actual roles/grants and clearly distinguish fixtures from hosted login.
For service worker checks use a fresh browser profile, wait for control, reload
deep links, clear registrations/cache/storage and repeat. A physical-device test
cannot be inferred from desktop Chrome viewport emulation.

SQL is not automatically deployed by Git or CI. Inspect live migration history,
save predecessors, validate current schema on free disposable staging, apply via
the migration workflow, verify and log in [CHANGELOG_SQL](docs/CHANGELOG_SQL.md).
Git revert alone does not undo SQL; rehearse the coordinated rollback and never
silently reopen privilege, minimum or price-confirmation bypasses.

Current evidence/limits: [launch status](docs/LAUNCH_STATUS.md) and dated reports.
Hosted authenticated smoke tests need valid test access; the available Auth admin
credential failed. Physical-device clear-storage testing has not been performed.
