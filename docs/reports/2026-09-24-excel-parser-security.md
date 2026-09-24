# Excel parser security update

## Verified exposure

Main at `574b7596` installed `xlsx` 0.18.5. `parseExcel` in
`client/src/lib/bulkImportService.ts` passes uploaded file bytes directly to
`XLSX.read` in the administrator's browser. The installed version and reachable
file-reader path meet the vendor's affected-version and usage conditions for
[CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533) (prototype
pollution) and [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363)
(regular-expression denial of service). No exploit was run against a real
administrator, production session or customer data. A successful privilege
escalation or data theft was not demonstrated.

## Focused change

Pin the free Apache-2.0 SheetJS Community Edition 0.20.3 tarball from the
[official installation source](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
The package lock records its SHA-512 integrity. The bundled changelog records
the prototype-pollution fix in 0.19.3 and regex fix in 0.20.2. Eight dependencies
used exclusively by the old distribution leave the lockfile; unrelated package
versions and application business rules are unchanged.

## Validation

- Clean `npm ci` succeeded from the updated lockfile.
- Three compatibility tests exercise the actual codecs and application entry
  points: XLSX and legacy BIFF8 imports preserve Gujarati/text identifiers,
  leading-zero barcodes, grouped prices, enquiry values and numeric rejection;
  the real downloadable template round-trips both sheets and all columns.
- A disposable local browser page called the real `parseExcel` using `File`
  and `FileReader`, with synthetic XLSX and XLS data. Both retained two valid
  rows and rejected the malformed-price row; console errors were empty. No
  database writes were made. The temporary page was removed before commit.
- `npm audit --omit=dev --json` returned zero runtime advisories on 24 September.
  The complete installation still reports nine development-tool advisories
  (five high, three moderate, one low). Those are not automatically demonstrated
  storefront exploits and are not suppressed or changed by this focused fix.
- Full local `npm run ci` passed: TypeScript, storefront guardrails, 147
  application tests, 41 authorization assertions, production build and PWA.
  GitHub CI and deployment results are recorded in the associated PR.

These compatibility checks are not a malicious-workbook fuzzing suite or proof
that all possible spreadsheet inputs are safe. Full-schema staging for the
separate order migrations remains blocked and is unaffected by this change.

## Deployment and rollback

This is a frontend dependency update; no database migration or new service is
required. Normal CI and deployment install the pinned tarball. Reverting this
PR restores the prior lockfile and parser but reintroduces the known vulnerable
version; prefer a forward fix if compatibility problems appear. Preserve both
Excel import formats and template generation when evaluating any replacement.
