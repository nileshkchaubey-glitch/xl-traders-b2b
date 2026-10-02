# Browser AI credential exposure and containment

Verified source defect: aiService read a private VITE provider credential and
called Anthropic directly from publicly downloadable admin JavaScript. Admin UI
authorization does not protect deployed code/assets. Before the fix, the exact
#210 Pages deployment c52a9f48 contained an Anthropic secret-format value in its
aiService chunk beside the x-api-key header and provider endpoint. It was not
printed, persisted in evidence or used to make a provider request. Evidence stores
only asset name/hash and boolean results. Known-format scans cannot detect every
possible credential type and do not establish provider usage or billing history.

Removed the provider client, private environment reads and description-generation
controls. Smart Paste now uses the existing local text rules, labelled honestly
and with review required. It sends no text to a provider. A bare product name no
longer fabricates a description or missing unit. Manual descriptions remain
editable. No backend, provider, credential, paid request or service introduced.
Catalogue writes and ordering/pricing rules remain unchanged.

The existing CI storefront checker now rejects private credential/provider paths
across all client modules, including admin/UI modules; it never prints matched
values. Its existing storefront copy/arithmetic exclusions are retained. A planted
private VITE read in an admin file was detected with exit 1, then removed and
legitimate code passed with exit 0. Tests mentioning fake values are excluded.

Validation: Node 20.20.2 npm run ci passed, 273 application tests plus 41 existing
authorization, 12 minimum and 13 reconfirmation assertions; TypeScript, guardrails,
build/PWA passed. Local parser regressions ensure no fetch despite a fake private
environment value and no invented bare-name fields. An additional build with a
fake private VITE sentinel contained neither that value nor the provider endpoint
in all 35 emitted JavaScript chunks. Actual Chrome at 390×844 and 1440×900 passed
local extraction, bare-name review/populate, manual master-description editing,
removed AI controls and real Tab. Zero provider/database requests, page errors or
overflow. Exact merged deployment scans must still be observed after release.

## Required incident follow-up

Removing code does NOT revoke an exposed credential. Historical immutable Pages
assets and already installed service workers can retain predecessor JavaScript.
The owner confirmed on 2 October: "Already revoked and settings removed."
This confirms revocation and removal of the private VITE hosting variable by the
owner. Do not reuse the exposed key. Independent provider-console/activity review
was NOT TESTED by this agent; no paid/live-key API call was made to test validity.
The focused PR preview's 35 emitted JavaScript chunks contained no known private
key format, privileged JWT or Anthropic endpoint. Old assets may retain the now
revoked value; new code no longer includes or uses it. This incident is contained
based on owner confirmation plus the deployment scan, not a provider activity audit.

Deployment: code-only build with required CI green; verify every emitted Pages
chunk via the exact merged service-worker precache manifest. No SQL/migration.
Rollback must keep provider paths/credentials disabled: disable local Smart Paste
if necessary or forward-fix. Do not revert to the exposed browser-AI predecessor.
