# Customer admin-route regression — 3 October 2026

Verified against main `649c58cc457313491c942a22711ed8d786a06778` on the
primary Cloudflare Pages site using the owner's approved customer session.
The live profile was active and not an admin. `/admin` remained on
“Loading admin panel…” across repeated observations; no admin controls appeared.

`AdminDashboard.tsx` and `AdminProductEditor.tsx` called `refreshProfile()` inside
an effect depending on `isLoading`. That method sets `isLoading=true`, cancelling
the effect before its awaited result can redirect. When loading resolves, the
effect starts another refresh. The dashboard bug was observed live; the editor
contains the same verified cancellation mechanism.

Both routes now use `components/admin/AdminAccess.tsx`, matching the existing
Masters access pattern. Authentication/profile initialization owns profile reads.
Unresolved authentication shows a status; guests go to `/auth`; customers go to
`/`; only an authenticated, database-backed admin mounts the page and its data
loaders. Redirects replace history. Email/metadata cannot grant access. Supabase
grants, profile protections and RLS are unchanged.

Regression tests in `pages/AdminAccess.test.tsx` failed against the predecessor
and passed after the fix. They cover both pages, unresolved profiles, customers,
guests, stale unauthenticated admin flags, allowed admin content and revocation.
Static-render tests prove that denied callers do not mount protected content;
they do not replace the separate hosted redirect check.

Commands: pinned Node 20.20.2, `vitest run client/src/pages/AdminAccess.test.tsx`
and `npm run ci`: 297 application tests, 41 authorization assertions, 12 minimum
order assertions, 13 price-reconfirmation checks, storefront guardrails,
TypeScript and the production/PWA build passed. Exact merged deployment results are recorded in
the PR. Browser evidence remains in ignored `tmp/launch-20261003/`; no account
credentials or customer contact details are committed.

Deployment is the existing Cloudflare Pages Git integration. Rollback is a
focused revert of this guard change through a green PR; it needs no SQL or data
rollback. Reverting would restore the customer redirect defect. No database
migration, new dependency, authentication method or business rule is introduced.
