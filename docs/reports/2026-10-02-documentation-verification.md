# Current-document verification

Documentation-only Block C. Inventory was committed before reducing CLAUDE.
Its 35 H1/H2/H3 sections total 109,234 original bytes. CLAUDE is now about 5.8 KB;
AGENTS about 2.5 KB. Ten complete pre-cleanup guides are preserved in archive,
matching main content with only Git newline normalization. No runtime, dependency,
SQL, configuration or workflow files change in this PR.

| Surviving claim | Current code/evidence checked |
| --- | --- |
| Stack, routes and actual Home sequence | package.json; App.tsx; pages/Home.tsx; StorefrontLayout/Header/Footer |
| Dashboard/editor lazy, other routes pending | App.tsx dynamic and eager imports; actual build chunk output |
| Guest explicit columns, session sorting/gates | productService.ts GUEST_PRODUCT_COLS/publicProductQueryShape; masterService; current search/privacy tests; live anon denials |
| Selling-unit price, pack size/MOQ, model helpers | orderingModel.ts, priceEntryMode.ts, cartStore.ts and tests; current RPC validation |
| Guest enquiry and protected checkout | orderMessage/orderService/Cart; #196 immutable Pages mobile/desktop zero-write/privacy checks; #191/#193 live definitions and rolled-back role probe |
| Admin flags and confirmation handling | authStore/Auth; #198 tests; live protect_user_profile_privileges definition/trigger; provisioning docs |
| Catalogue editor/shared save, current UI primitives | AdminDashboard, CatalogTreeEditor, CatalogProductPanel, useProductForm/productForm; remaining directory; #199 per-file import proof |
| Real keyboard focus/height behavior | #199 actual component fixture at 390×844/1440×900, Tab/Shift+Tab/Escape/focus return and computed 85vh |
| Semantic tokens, shell/theme | index.css @theme/xl-shell/theme variables; ThemeContext.tsx; shared storefront components |
| Live counts/health, draft gates, separate leads | captured live relations/policies/views and current services; authorization tests |
| Current imports/SheetJS/template | bulkImportService/templateService; real XLS/XLSX/template compatibility tests; TEMPLATE_COLUMNS retained |
| Settings query and actual mismatch | AdminSettings maybeSingle, live business_settings key/value columns; tracked as pending, not claimed working |
| Applied migrations/status/rollback | live migration history and exact definitions/grants after authorized application; CHANGELOG_SQL |
| CI/Node/build/PWA/routes/headers | package scripts, .nvmrc/.node-version, ci.yml, vite.config.ts, _headers/_redirects; actual successful CI/main/Pages checks |

Known stale claims removed from active guides: retired HeroMotionTiles and
HomeCatalogueShowcase, framer-motion scroll reveals, ProductsTable virtualization,
nonexistent check-price-entry/check-ordering-model scripts, incomplete ordering
implementation claim, client email-admin fallback, broad expendable-catalogue
permission, blanket owner-only SQL/self-merge gates, single-vs-maybeSingle issue,
old Home composition, old fixed card measurements, and repeated stale roadmaps.
Current templates/admin settings/AI/code splitting/history remain explicitly
partial or pending. A multi-pack-step mismatch is recorded for Phase 5.1 rather
than hidden by the documentation rewrite.

All other docs were classified: dated audit/reports and docs/sql verification
are historical evidence; the plan, Phase A audit, monitor proposal and HANDOFF
now explicitly point to current launch status. Old archive links/code examples
are retained as original provenance, not active executable instructions.
Historical measurements are not claimed to describe today's UI.

42 relative links in the focused active guides resolved to existing files/folders.
All ten archived sources matched the previous main. Active-guide whitespace checks
passed. The complete diff reports one existing trailing blank line preserved in
the CODEX archive; it is retained to keep the original source intact.
Full Node 20.20.2 `npm run ci` passed: 179 application tests, 41 authorization,
12 minimum-order and 13 reconfirmation assertions, TypeScript, storefront checks,
production build and PWA generation. No physical-device or hosted-auth result
is inferred from source review.
