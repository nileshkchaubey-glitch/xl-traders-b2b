# Ordering fields in file and Sheets imports

Verified defects: bulkImportService omitted order_unit/order_step from both
standalone and variant writes/export; template omitted the columns and used
piece labels for selling units. Excel headers did not match the documented
case-insensitive behavior. Its legend was parsed as a product. Google Sheets
used a separate parseFloat/parseInt mapper that truncated malformed numbers,
defaulted units to pcs and could confuse unit/order_unit through fuzzy mapping.
Three planted CSV/XLS/XLSX regression tests failed before implementation.

The shared orderingSettings boundary now validates all four import paths.
Explicit pack size/order-step combinations are checked during parsing; partial
SKU updates are checked against current settings before writing. Blank ordering
fields and pack size preserve existing SKU values; new rows use pack ordering
and size-step defaults. Explicit values are emitted for every row in a mixed
upsert, avoiding missing-column/default overwrites. Existing-setting read errors
fail closed before any write. Both variants and standalone rows use the same
rules, without converting selling-unit prices or adding a pack_size column.

New products always remain drafts, even if a sheet requests publication;
existing SKUs preserve status when blank. Known ordering failures are visible
in file dry-run and prevent its Import action; service validation also prevents
invalid writes independently. Google mapping errors are visible instead of
silently dropping bad values. CSV export carries ordering fields and unknown
MOQ stays blank. Counts use a pre-write SKU snapshot; concurrent admin writes
can affect add/update classification. File logs distinguish CSV from Excel.

Template requirements live on Instructions; no legend is emitted as data.
Legacy exact legend rows remain accepted. Synthetic EXAMPLE ONLY rows show
box/pack selling units and pack/pcs counting with blank prices; replace them
before importing. Category/name-match/tags instructions were corrected against
code. No real product, price conflict, category, account or order was changed.

Validation on Node 20.20.2:

- npm test -- client/src/lib/excelCompatibility.test.ts client/src/lib/bulkImportService.test.ts:
  real patched SheetJS 0.20.3 XLSX/BIFF8 and Papa CSV codecs; ordering rejection,
  normalized headers/aliases, actual two-sheet template round-trip, legacy
  legend, mixed/new/existing/derived-variant payloads, fail-closed reads,
  draft-only insertion and CSV export/re-import checked. A derived-SKU test
  initially used the wrong letter case; corrected to the unchanged uppercase
  variant-label convention, then passed.
- npm run ci: 231 application tests, 41 authorization, 12 minimum-order and
  13 price-reconfirmation assertions; TypeScript, storefront guardrails and
  production/PWA build passed on synthetic local databases.
- Real Chrome at 390×844 and 1440×900: actual file inputs parsed CSV, XLS and
  XLSX, displayed ordering fields, rejected off-step rows, ran dry-run and
  passed correct draft/price/ordering payloads to mocked database writes.
  Actual Google Sheets mapping UI rejected a malformed rate and preserved
  the existing SKU's pcs/size/step/publication. No viewport overflow, page
  errors or hosted Supabase request occurred. Initial smoke selector did not
  include the displayed filename; corrected the harness and reran all paths.

Hosted import writes are NOT TESTED: valid admin test access is unavailable.
Browser database/Google responses were synthetic, not hosted operations.
There is no SQL migration, production mutation, added dependency or paid
service. Deploy the focused code PR after green required checks. Rollback is
a code revert; do not delete imported records or weaken grants/policies.
