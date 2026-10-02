# Hosted file validation — 2 October 2026

Current production runtime `8d8104e4456791279622036869b0d0312aa6ebbf` (#215),
[main CI 37008743602](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/actions/runs/37008743602)
and exact [Pages 83512408](https://83512408.xl-traders-b2b.pages.dev) passed.
This follow-up supersedes the earlier file-permission blocker for the tests below.
Owner approved temporary file-URL access and manually enabled it; Chrome internal
settings are inaccessible to the browser tool. Owner was asked to disable it
again after all file chooser tests finished; restoration is not yet confirmed.

Existing authorized admin Chrome session, actual hosted importer and Storage;
no synthetic REST interception, new account, privilege change or invented real
catalogue content. Exact synthetic SKU was absent before the first import.

| File             | Hosted dry run/import                                  | Persisted synthetic fields           |
| ---------------- | ------------------------------------------------------ | ------------------------------------ |
| CSV              | One new SKU, added 1, updated 0, skipped/errors 0      | Price 100, MOQ 2 packs, step 300 pcs |
| XLS (real BIFF8) | One existing SKU, added 0, updated 1, skipped/errors 0 | Price 110, MOQ 3 packs, step 400 pcs |
| XLSX             | One existing SKU, added 0, updated 1, skipped/errors 0 | Price 120, MOQ 4 packs, step 500 pcs |

All retained unit box, pack size 100, order_unit pcs and the same UUID. Blank
Excel status preserved draft. Source files were generated with current pinned
SheetJS 0.20.3; actual hosted parsing, dry run, writes and subsequent SQL reads
verified XLS/XLSX compatibility and ordering fields. A transient browser click
timeout caused no write; UI/SQL proved target absent before the successful retry.
No duplicate fixture was created. Raw test rows/logs preserved before cleanup.

Actual Workbench upload to the test SKU created exactly three fresh objects,
with no overwrite and no paid transformations:

| Object       | Decoded size | Bytes  |
| ------------ | ------------ | ------ |
| Original PNG | 2400×1200    | 11,144 |
| 1x WebP      | 800×400      | 1,132  |
| 2x WebP      | 1600×800     | 2,840  |

Storage metadata listed all three with correct MIME. Downloaded originals match
the source byte for byte (SHA-256
`97d22ed01afe41851f04bcaea0b920bfa3c4a11f75db09c596f1e7c4df1b04ae`).
Pillow decoded/verified all dimensions; all public object reads returned 200.
The primary URL persisted to the 1x rendition. Actual editor image decoded at
800×400 on desktop 1489×623 and mobile 391×844, without page overflow.
The imported draft PDP returned Product not found even in the admin session.
This live check covers the SKU Workbench path; earlier real canvas/component
fixtures cover all five upload callers and responsive srcSet. It does not claim
all callers, actual product photo quality or physical mobile hardware were tested
against hosted Storage. No fixture was published.

Database cleanup completed after full snapshots and exact ID/SKU/status/price/
ordering/timestamp/image guards plus order/gallery/enquiry dependency checks.
Deleted only the one task-created draft and three exact task import logs.
Original products/public 143/139, orders/items 2/2, sentinel 1 and the original
import log restored. No real customer/catalogue/order or category row changed.
Full actual SQL and rollback artifacts are in [CHANGELOG_SQL](../CHANGELOG_SQL.md).

**Three test Storage objects still pending cleanup.** Exact bucket product-images,
folder products/ZZ-LAUNCH-20261002-VALIDATION, stem
ZZ-LAUNCH-20261002-VALIDATION-96bfd10c-3a87-47ae-af07-f5ca00ae4b90,
suffixes `.xl-original.png`, `.xl-web-800w-1600w-1x.webp`,
`.xl-web-800w-1600w-2x.webp`. Total 15,116 bytes. All bytes and IDs/metadata are
preserved locally. Current Chrome Supabase dashboard login cannot access this
project; no local CLI/backend credential is available. Owner was asked to sign
into the existing account with target-project access. Do not remove metadata
directly in SQL or introduce new backend/authentication merely for cleanup.
Use the normal Storage API/dashboard to remove only these exact verified keys,
then verify both metadata and underlying objects. No bucket may be deleted.

Actual verification command:

```sh
python tmp/launch-20261002/verify-hosted-images.py
python tmp/launch-20261002/check-final-doc-links.py
npm run ci
```

Node 20.20.2 full CI passed: TypeScript, 18 storefront rules, 287 application
tests, 41 authorization assertions, 12 minimum-order checks, 13 reconfirmation
checks and production/PWA build (59 precache entries). Relative-link check passed
61 links; `git diff --check` passed. Role/migration CI tests use synthetic local
schemas; the hosted import/image evidence above is separate actual production use.

Ignored evidence includes hosted-import-first.json, hosted-import-final.json,
hosted-upload-product.json, hosted-image-objects.json, hosted-image-verification.json,
hosted-image-downloads/, hosted-import-cleanup.sql and the import/upload screenshots.
Private admin screenshots and real catalogue rates are not committed.

Remaining: exact Storage cleanup/access, file-URL permission restoration,
customer-role hosted checkout/positive history (test login unavailable), physical
device check and owner catalogue/11 Hinged Box decisions. Provider revocation
and hosting-variable removal are owner-confirmed; independent console activity
untested. These limits are not passing tests or verified code defects.
