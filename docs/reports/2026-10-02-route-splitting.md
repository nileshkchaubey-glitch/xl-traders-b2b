# Route-level code splitting verification

Current App.tsx eagerly imported eight storefront pages, NotFound and AdminMasters.
Dashboard/editor were already lazy. Converted the remaining pages to React.lazy;
Suspense stays inside the existing storefront shell so navigation retains the
header/footer. Accessible loading status replaces the page only. Admin and 404
chrome, authorization, auth initialization and checkout remain unchanged.

## Same-environment production bundles

Node 20.20.2, unchanged dependencies/build configuration/environment. Before:
origin/main 9c2ef63b9eb4010a65a4c7cc5fb0269892300b2b. After: focused App.tsx change.
Sizes are actual emitted bytes; gzip is Node zlib's default compression, not an
assertion about CDN compression. Tiny shared modules are listed as emitted.

| After emitted chunk            | Before bytes | After bytes | After gzip bytes |
| ------------------------------ | -----------: | ----------: | ---------------: |
| AdminDashboard-Cygrjzkd.js     |       880594 |      881101 |           265908 |
| index-CwYRdoQA.js              |       827330 |      615837 |           183563 |
| aiService-CcnsicWb.js          |    new chunk |       60092 |            19112 |
| productForm-CfFlRoSt.js        |        35730 |       35831 |             9442 |
| AdminMasters-C4i4TLcZ.js       |    new chunk |       33722 |             8634 |
| drawer-BgFrE_AI.js             |    new chunk |       31974 |             9631 |
| Catalog-C1YJhAwr.js            |    new chunk |       18866 |             6222 |
| AdminProductEditor-CWQXwaHM.js |        17553 |       17690 |             5827 |
| ProductDetail-DZg7Hsvi.js      |    new chunk |       10067 |             3456 |
| Cart-BhjPgK3s.js               |    new chunk |       10003 |             3658 |
| Home-D8VEhlb6.js               |    new chunk |        6823 |             2549 |
| Account-CLsK7TZx.js            |    new chunk |        6749 |             2324 |
| ProductCard-Dc2hjtXT.js        |    new chunk |        5881 |             2378 |
| Auth-s7h26nOf.js               |    new chunk |        5557 |             1880 |
| Search-D_c9c3fx.js             |    new chunk |        4041 |             1818 |
| masterService-Bpghajn2.js      |    new chunk |        3820 |             1160 |
| ProductMeta-Dl5H6gyw.js        |    new chunk |        3158 |             1379 |
| orderService-YfR6TGO5.js       |    new chunk |        3052 |             1379 |
| Categories-C6xdp4YH.js         |    new chunk |        2647 |             1221 |
| star-agSNL-TZ.js               |    new chunk |        2505 |              986 |
| promoBannerService-CBIkZsKg.js |    new chunk |        2197 |              973 |
| NotFound-CgeQW6El.js           |    new chunk |        1407 |              698 |
| PromoBanners-BWbWBL_N.js       |    new chunk |        1306 |              743 |
| PageTitleBar-DiiPAHth.js       |    new chunk |        1165 |              651 |
| BackToTop-x0hyTyNZ.js          |    new chunk |         842 |              558 |
| eye-B4Pslx_O.js                |    new chunk |         630 |              340 |
| card-WHKqLljl.js               |    new chunk |         354 |              227 |
| trash-2-ChLPognG.js            |    new chunk |         354 |              249 |
| circle-alert-BJhPzeB3.js       |    new chunk |         246 |              184 |
| mail-BOPkUDuH.js               |    new chunk |         207 |              195 |
| skeleton-dm7y33Dt.js           |    new chunk |         197 |              174 |
| arrow-up-BXJbkpX3.js           |    new chunk |         158 |              158 |
| plus-DFN79yLC.js               |    new chunk |         145 |              144 |
| loader-circle-BxX6fI0i.js      |    new chunk |         135 |              151 |
| chevron-right-B0X3ooz4.js      |    new chunk |         126 |              137 |

Before entry: 827,330 bytes, gzip 242,816. After entry: 615,837 bytes, gzip
183,563. The old four JavaScript chunks also included AdminDashboard 880,594,
productForm 35,730 and AdminProductEditor 17,553 bytes. Shared modules may move
between chunks; individual sizes are not total download savings.

## Actual Chrome behavior

Fresh contexts, browser cache cleared, 390×844 and 1440×900, local production
preview before/after with service workers blocked to isolate the foreground
execution graph. Home initially loaded one old script (827,330 decoded bytes)
versus ten new entry/page/shared scripts (636,544 decoded bytes), 23.1% fewer
bytes. Observed transfer sizes/durations are local single observations, not a
latency benchmark. The saved immutable pre-change Pages observation used an
environment-dependent 829,935-byte entry; it is not mixed into the local ratio.

Home did not request catalogue/auth/account/cart/search/categories/PDP/admin
page chunks before navigation. An intentionally delayed Catalog chunk displayed
the accessible loading status while retaining one header/footer. Actual links
navigated Home → catalogue → product details. Direct cart, search, categories,
guest account, auth, explicit and unknown 404 routes passed. Guest admin,
masters and new-product routes redirected to auth. No chunk failure, page error,
horizontal overflow or Supabase write occurred. Guest cart's stale fixture rate
remained hidden; both actions worked, WhatsApp was intercepted rather than sent,
no DB order request occurred, and sign-in preserved the cart.

Full npm run ci passed: TypeScript, storefront guardrail, 252 application tests,
41 authorization, 12 minimum-order and 13 reconfirmation assertions, build/PWA.
Hosted positive admin/checkout remains NOT TESTED without valid test access.
Chrome viewport emulation is not a physical-device test.

## Service worker and deployment limits

The existing offline precache is retained. It increased from 29 entries /
2,802.49 KiB to 60 / 2,810.04 KiB. Normal service-worker installation fetches
chunks in the background, including admin chunks. This PR reduces initial page
execution, not all offline downloads; no claim that customers never download
admin code is made. Practical controlled/offline tests remain a separate final
launch verification. Existing large admin chunk warning remains visible.

Deployment: normal code build, no SQL or infrastructure. Rollback: revert the
focused code commit. Required PR checks and exact merged main/deployment must
be observed before treating the change as released.
