# Verified remote branch cleanup — 2 October 2026

126 remote branches were deleted after exact-tip inspection. Candidates were
listed in the task log before mutation. Evidence uses GitHub merged PR heads,
tip ancestry, equivalent patches, or preserved document-only changes. Unmerged
work with no such proof is kept. No local branch or working-tree file was deleted.

Recovery bundle: `tmp/launch-20261002/remote-branches-before-cleanup.bundle`,
verified with `git bundle verify`, SHA256
`ec67da47ae48089c8f86216042844e19a59d56b0052bf6e8a596d0f21711be21`.
Every deleted tip is also recorded below. Recover a saved tip from the bundle
and push that exact SHA to its original branch name if needed.

`feat/storefront-rate-card` and tag `pr142-backup` were both verified unchanged
at `9ed939bc9ee8761cbe55b3e8ad495d7d242ee838`. Thirty remote branches remain
before this evidence PR is pushed, including main and the protected rate-card.
The 16 friendly-dijkstra branches, four closed-unmerged devin branches, and
other unverified tips remain because their needed work cannot be disproved
by merged state alone. Their preservation does not block code launch.

The two rescued document branches were deleted only after proving that their
only changes match the current main archive under canonical Markdown formatting.
Historical branch names in audit/archive documents remain provenance, not
instructions to load guidance from deleted branches. All useful documents are
in main. CLAUDE history is reconciled separately in Block C.

## Deleted tips

| Branch | Tip SHA | Evidence |
| --- | --- | --- |
| `chore/claude-code-extensions` | `617bb61a01b24a8c5e0c6b5a0dd5793e7482f80b` | merged PR #161 |
| `chore/claude-suggest-commands` | `81c4d975c7259c6bf03bf2e0f41893eb33694a24` | merged PR #61 |
| `chore/ignore-local-import-data` | `a499752046eb3b8f9084050f1d438076b695aff4` | merged PR #100 |
| `chore/phase-0-repo-hygiene` | `2c1210af5239544a87b5fd8ced68b65099cd6450` | merged PR #54 |
| `chore/remove-dead-admin` | `1cd58b94600ca4cdc025a52e7e6c49a09c252732` | merged PR #17 |
| `chore/storefront-guardrails` | `bd1dd79a136bed7110c97b58cb7b3971f8f53389` | merged PR #155 |
| `chore/type-safety-cleanup` | `761d42deaff4df2d21a1f028c2564e834ea7a3c7` | merged PR #83 |
| `ci/typecheck-gate` | `9ca7f650d71d5633292eaf3cc29172e4250cb77e` | merged PR #84 |
| `claude/affectionate-fermi-gvBY0` | `e5b10d8a8ab2bc757332360c316acce05f3eb2e6` | merged PR #25 |
| `claude/datatable-viewport-scroll-risk-0o8yxu` | `882707b30a7654a35b415d45c136aec6a556775f` | merged PR #116 |
| `claude/friendly-dijkstra-7wnrdm` | `2fd5549fa1b37bc2e9481dfaa3280b8012bb1fe1` | merged PR #46 |
| `claude/friendly-dijkstra-9l0k9f` | `15418dde89817da730abf27cf434c50405b4b0ac` | tip is ancestor of main |
| `claude/friendly-dijkstra-IAxKM` | `140dd391a65c6058a320baaea2791096d84b008b` | merged PR #10 |
| `claude/friendly-dijkstra-ascm9y` | `9a65b7897c978fd6bcc07f7fdcb02529607c52a0` | merged PR #41 |
| `claude/friendly-dijkstra-bswrnb` | `9706b87ebf371f4862b43d247258dd695be91637` | merged PR #35 |
| `claude/friendly-dijkstra-ms9ded` | `b66b0a6808d2f35560240618d85581bc628eb739` | merged PR #49 |
| `claude/pcs-ordering-model-design-4d44sm` | `fdf03daaf4d183146338fe4047e1cc8fe8c87318` | merged PR #143 |
| `claude/productstable-mobile-layout-rnedaa` | `993f89826ea0285317078b397735dfcb82af28e0` | merged PR #58 |
| `claude/remove-admin-v2-docs-refresh-2klfb8` | `07da8e724ede0f000828d54090ad276ac9785811` | merged PR #81 |
| `claude/retail-cart-bar-min-order-jwa688` | `b3632a55cf9929ea089c2fa8fdbc27f17665c5de` | merged PR #108 |
| `claude/sharp-cerf-ytjo9j` | `367b1c85ccb7eb552e844e8bda68a115fc641d60` | merged PR #75 |
| `claude/storefront-design-proposals-77zaju` | `13f6cea152de37d38ad53f63caed1317787ed940` | only branch change is document preserved in main archive (formatting-only differences) |
| `claude/storefront-pr1-foundation` | `7e04a4a0b3d12cbf86f96f48bfb1d8a0aa92e8e8` | merged PR #112 |
| `claude/storefront-pr2-showcase` | `ab0bb4b14f888c7deed1f4a6599bb515b0211f9a` | merged PR #113 |
| `claude/storefront-pr3-hero` | `05200e3eeb0d0808b341c502b870e253c398c51c` | merged PR #114 |
| `claude/update-claude-md-docs-adhumr` | `22a8f65653e24cc5682bfbc81b2f7c8b4ef60d8e` | merged PR #56 |
| `cleanup/remove-unused-ui-and-fix-sheets` | `1dff2c67939fb01c6fadb50bf03eaea0bc1f571b` | merged PR #199 |
| `cleanup/verified-unused-exports` | `a94ce553de24efad5fe4c7d06cd8a0221b860956` | merged PR #201 |
| `codex/admin-order-customer-contact` | `6117eac06c2b63dfed1b50ff99db78da01778328` | merged PR #192 |
| `codex/atomic-order-creation` | `97fa8376764065d89fea759bbc0c7a0eb7e49310` | merged PR #184 |
| `codex/authz-security` | `0202f52a98acbd92a8c39d3df4cd2237399be52b` | merged PR #183 |
| `codex/cart-price-visibility` | `b6b3272b21e6e4c46d81caa0b64854a5889ba5d8` | merged PR #190 |
| `codex/customer-price-reconfirmation` | `5fcd964906afe6849b357e6389132c0b8bc08464` | merged PR #193 |
| `codex/enforce-server-minimum-order` | `af3e913195d4936f4dcbd2445119137b502c4c6d` | merged PR #191 |
| `codex/fix-category-navigation` | `b88fd9c5191760e5d4259bdde5362126e7dcf181` | merged PR #185 |
| `codex/guard-admin-masters` | `ab413096c167e6e3660a8840badd974db08c6cbf` | merged PR #188 |
| `codex/harden-import-validation` | `74306d32aa191eae6993efae9ee6e35bf05c59fb` | merged PR #186 |
| `codex/patch-excel-parser` | `4f1b798d7652536f015a81aa681fe315956a99b4` | merged PR #194 |
| `codex/restore-guest-whatsapp-cart` | `4122996d12a67a52f19e5ea9766277e4089c49df` | merged PR #196 |
| `codex/restore-protected-audit-screenshots` | `89d2ba66389ad332bd459df2baf6fcf391162108` | merged PR #195 |
| `codex/run-authorization-tests` | `1926a6cc699e96059b591cae65d48026f34af3e5` | merged PR #187 |
| `codex/set-up-project-monitor-automation` | `d57675a1292d0d57abb1f7013c984d1fb74556c9` | merged PR #9 |
| `codex/storefront-sku-search` | `9693d5eb8e3ea13d6d5e5bd4a51c3e91c78e9995` | merged PR #189 |
| `docs/autonomous-merge-policy` | `cfb2e020a3b2173e76cfeb8131380a03bc5ce46a` | merged PR #109 |
| `docs/block-b-audit` | `70daec7be5d896dc4b4a4b41a00a113aa4f9768a` | merged PR #182 |
| `docs/codex-blueprint-and-datatable` | `21a24129549bbb9618db4b2be723049be6abf973` | merged PR #115 |
| `docs/data-entry-ux-audit` | `5d3f878ad0dceafd037375cf865d8d0fa29508b3` | only branch change is document preserved in main archive (formatting-only differences) |
| `docs/design-system` | `f124b8230a0234ee999aebbfd83d925fdcc85bc3` | merged PR #96 |
| `docs/record-validated-checkout-deployment` | `316ee68386c4019361298a207598afee0ac46adf` | merged PR #197 |
| `docs/storefront-v3-plan` | `7d5b3ae047eedafe4f39cfb5a3f5a58aa4216d17` | all non-main patches equivalent to main (git cherry), no open PR |
| `feat/2-level-group-catalog` | `93da7193d253ad7b006b1065b26db915055de824` | merged PR #14 |
| `feat/admin-polish-a` | `36c2e6f5e228fa9e6e9fa7c7152445beed48f656` | merged PR #101 |
| `feat/admin-polish-b` | `4578d7d3a9dc9ef2808a66d59ed53d0072fe4c9e` | merged PR #102 |
| `feat/admin-polish-c-resize` | `c3e2dce2b6555eef74ded45f3ea2d3ee89bf6003` | merged PR #103 |
| `feat/admin-v2-phase11-category-groups` | `a45f997922cb6bdf28ff52ce31819cd9fcb930b6` | merged PR #79 |
| `feat/admin-v2-phase8-9-10` | `a4659b09ee34c8033f79a9bc7f94d03934fb858f` | merged PR #78 |
| `feat/admin-v2-phase8-ux-polish` | `7e685c06ad04fc00fca71a045a1cb2b8915fb398` | merged PR #77 |
| `feat/agent-kit-setup` | `c95472967f3475d686fb996d394d477602fba56d` | merged PR #11 |
| `feat/bulk-update` | `98775a7ca90a3dd6a9eb0477f078689aa0aaf3ce` | merged PR #50 |
| `feat/catalog-editor-parity-close` | `f6897dd775efe787f1db93b29d407f69380457ce` | merged PR #98 |
| `feat/catalog-health-seo` | `dc85b6ba046112ed4d103d2b041eaf68ee91dd28` | merged PR #38 |
| `feat/catalog-tree-editor-p1` | `efff1aef88d971ddd451c4782bff8043b5b0b8f4` | merged PR #93 |
| `feat/catalog-tree-editor-p2` | `f2375145881330a569e32afc33147d4bf4d9749e` | merged PR #95 |
| `feat/catalog-workbench` | `c0f04f3a47008bcd817b8b3b9f6b8b4f0cba1000` | merged PR #119 |
| `feat/desktop-prototype-redesign` | `7867a861fdd2f20c4225cdcd4e11f5ff43cc5aa4` | merged PR #86 |
| `feat/dukaan-style-reskin` | `727623f748967db94b4635879202b6ea060d7574` | merged PR #104 |
| `feat/fast-entry` | `d20b348261053af2f58b2494c50ed96fac51560d` | merged PR #40 |
| `feat/import-ui-fix` | `95b0a330112f0bd6ae52b92f8b579f0799ae7a45` | merged PR #51 |
| `feat/import-ui-polish` | `2a0457fdaeb884a51635fc5769dd582efc8f67bb` | merged PR #53 |
| `feat/incomplete-data-foundation` | `ed450bc1210a0fe531f6a97c78640c1350ad3e3d` | merged PR #47 |
| `feat/missing-data-filters` | `12495a57402279c6a3f92903ab077cac822196a4` | merged PR #48 |
| `feat/mobile-location-bar` | `6ccd85c358a9f1d9430822197569dcc0d69e87ce` | merged PR #166 |
| `feat/phase-1-products-redesign` | `7cec59a66aa80030078afa6ad7a4965e13e0dd60` | tip is ancestor of main |
| `feat/phase-1-products-redesign-dczlzc` | `7cec59a66aa80030078afa6ad7a4965e13e0dd60` | merged PR #57 |
| `feat/phase-2b-remove-admin-products` | `de0653aea40a3989caed098914930a957aae3182` | merged PR #99 |
| `feat/phase-a-design-tokens` | `f412e26480572a0fabbcc7509ee60a6f78909b34` | merged PR #87 |
| `feat/phase-b-admin-content` | `9b30040ec718890aa3015962aba1844e05300d16` | merged PR #88 |
| `feat/phase-c1-mobile-admin-shell` | `7ed1f2034bc2a8b691cfe00a108680b4dd27e642` | merged PR #89 |
| `feat/phase-c2-mobile-product-cards` | `38017461b8d31993968d9db71cf714c499c96833` | merged PR #90 |
| `feat/phase-c3-mobile-image-upload` | `1981cf465ced251a5aa9890b7ada21e1b3148f2d` | merged PR #91 |
| `feat/phase-c4-mobile-admin-polish` | `a84b9c7a2c6104ef3e119ce26487587f570a420a` | merged PR #92 |
| `feat/pim-p1-brands` | `8b1a69ac537b2c881defa9833dc0ee84ddcc7278` | merged PR #135 |
| `feat/product-variants` | `77ce5c22f7668e4cd599a00f694805cebd4789b6` | merged PR #45 |
| `feat/prototype-token-scale` | `284899117f9f45756737340b08855d57d167bb50` | merged PR #170 |
| `feat/pwa-installable` | `9f68081c1c4c5ac91b92cf0c8cc2249f62152bc3` | merged PR #111 |
| `feat/retail-trust-header` | `8bcc5d480ee3fff8385051dcf9d6fac4536328b6` | merged PR #110 |
| `feat/shared-datatable-p1` | `a9d9a6726d13b1fa400cbaf3ff446dae02c21035` | merged PR #97 |
| `feat/shopify-admin-design` | `67f3e9688977fa7acf2d93abcd8084182b784c16` | merged PR #42 |
| `feat/sku-cart-template` | `15616f870e5b33e5176971f6adc834cab26e9677` | merged PR #28 |
| `feat/storefront-pr1-trust-hero` | `b8c2c2f2890800ce7c0fb24be0c174d679b1989b` | merged PR #141 |
| `feat/storefront-v3-card` | `875d090e22fd2b76a9b2faa24232a935f045282a` | merged PR #151 |
| `feat/storefront-v3-cart` | `b1322ad725b7383cb6f7eba36bfb22f480c10ca8` | merged PR #153 |
| `feat/storefront-v3-copy` | `4eec1e9b3267dd524969c199bde8753bbf35b785` | merged PR #150 |
| `feat/storefront-v3-home` | `7f0616da7d54a6ad010cf5a8cce09e96e39e76e6` | merged PR #154 |
| `feat/storefront-v3-pdp` | `3780a668173713e6ec8207c9bf4531de2120b7b8` | merged PR #152 |
| `feat/storefront-v3-schema` | `7d91df77f59904c154cccd75c5e2e9b8c4f1643d` | merged PR #147 |
| `feat/workbench-polish` | `d3a68ea62882a7e612fbf72df467813294a9a0ab` | merged PR #121 |
| `fix/admin-console-errors` | `4081d091abdfe5d95f9a38d2ce856bee3a406d5c` | merged PR #29 |
| `fix/admin-refresh-final` | `8ae3ae10f83c8a9016057c339370540b2ddb0f42` | merged PR #30 |
| `fix/admin-v2-mobile-sidebar` | `ef2b3b7a5f157bbb92588fa0adf79042cb713357` | merged PR #76 |
| `fix/auth-token-refresh-only` | `a26cd31b50a21d5650bb71744b174cb2047cf294` | tip is ancestor of main |
| `fix/catalog-editor-blank-scroll` | `1fb4b5b5e811bccb507705c486146a5dbfc0a868` | merged PR #106 |
| `fix/catalog-editor-layout-columns` | `d8e5b046700f46737b7fdf213c145cf5f4bb4e17` | tip is ancestor of main |
| `fix/catalog-editor-sticky-right` | `fe726b536bd2762f8d84b4d563da9513ec0c2182` | merged PR #107 |
| `fix/catalog-sidebar-generic-brand` | `d841bb4a675102f61b3faafc77522a7a3fb121d4` | merged PR #136 |
| `fix/database-authoritative-admin-profile` | `40115dc32e6e415061cc53764533b845b028c314` | merged PR #198 |
| `fix/guest-product-cols` | `e85d93973e17fb3976c93a6f916b3c4091c4d9fe` | merged PR #16 |
| `fix/inline-edit-safety-pr-a` | `d528ff6377a925ca77e5c91ac63d0c3d8c893438` | merged PR #117 |
| `fix/rls-authorization` | `73687b692079018b8f2e9153edc1176cf74b3ea2` | merged PR #148 |
| `fix/rls-publish-gate` | `e541da0ddd64723f7e22f0c130de0bcc5c6433e6` | merged PR #118 |
| `fix/session-401` | `0c0a91fb438f284b828cee66964334bdce50f4e0` | merged PR #34 |
| `fix/settings-table` | `d577cd1b5761695a4ff146bd4560f63414eb9d94` | merged PR #37 |
| `fix/signed-in-refocus` | `fa7c6ff7b200d74ba90f8c3eacee9f1279104286` | merged PR #36 |
| `fix/storage-product-images-rls` | `ad0cfdcd7f67215fb3acd410d9c3ffa8350b3292` | merged PR #158 |
| `fix/storefront-pagination-and-real-features` | `d84c4158dbc186dfbdf7d8df308102d6db9c42ec` | merged PR #82 |
| `fix/storefront-pr0-anti-patterns` | `a93f442afe6bef830b84fef9153d6ad281bf4366` | merged PR #134 |
| `fix/supabase-demo-mode-fallback` | `6973d0ada5d66edab84ee64e776d38d5d34a8341` | merged PR #12 |
| `fix/template-image-cols` | `0fbe20d0eeb564c8bb1ae573eae3c2c9d82d60f3` | merged PR #39 |
| `fix/token-refresh-rerender` | `b85e65e45fc108600a4eaeca34bdadc249187fe0` | merged PR #31 |
| `fix/zero-price-guard` | `1d814faa0e0afc2c7c0e993e8d1796c192b0a851` | merged PR #94 |
| `integrate-admin-and-inquiry` | `227f92e9ef8eb7e7e141dc0a13e357b32f08c7da` | merged PR #27 |
| `nileshkchaubey-glitch-patch-1` | `e8a3cf4a8c715e92b2fe23a5aba706c4e51eee92` | merged PR #2 |
| `replit-admin-import` | `1ffd5b4acc94cd0e7d5ad572c89585b6949b5154` | tip is ancestor of main |
| `revert-31-fix/token-refresh-rerender` | `3412655847967487f9fa43ccb52c3056661b1a51` | merged PR #32 |
| `sync-claude-replit-improvements` | `ac6c391d739d35b212563e7a7bb453b9340c2890` | tip is ancestor of main |
| `v0/nileshkchaubey-5437-b97db728` | `e6891f18744bc7c513b7f548b28a2e2630a3a610` | tip is ancestor of main |

## Preserved tips

| Branch | Reason |
| --- | --- |
| `claude/friendly-dijkstra-41pAt` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-61a8ze` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-brhqt6` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-ewKsa` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-fa5bvz` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-km6d1x` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-pJ0xt` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-rSgjI` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-t2np8g` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-tgpyu6` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-vyybrp` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-w1zKo` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-wtthhp` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-wxcx3j` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-xFVKy` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `claude/friendly-dijkstra-zg0kw7` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `cleanup/verified-dependencies-after-ui` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `devin/1780685102-add-unit-tests` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `devin/1780685103-refactor-shared-utils` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `devin/1780685138-improve-error-handling` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `devin/1780685212-security-fixes` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `docs/hinged-box-data-note` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `docs/test-admin-setup` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `feat/catalogue-structure-a2` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `feat/pim-p2-inheritance-hint` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `feat/pim-p2-series` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `feat/price-protection` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `feat/storefront-rate-card` | explicitly protected or main |
| `fix/container-1440` | no exact-tip merged/ancestor proof; preserve unmerged work |
| `main` | explicitly protected or main |
