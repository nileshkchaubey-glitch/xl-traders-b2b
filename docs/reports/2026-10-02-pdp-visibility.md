# Public PDP activation gate — 2 October 2026

Verified defect: `client/src/lib/productService.ts` public `getById()` filtered
`status=published` but omitted `is_active=true`. Customer RLS already protects
inactive records; an admin's broader read policy allowed a deactivated published
product to appear on the storefront PDP. Catalogue, variants and reorder already
use both public gates.

The public database query now applies both gates. Explicit
`includeUnpublished: true` remains available to the admin editor. Guest column
selection and the opt-in demo dataset are unchanged. No database, catalogue,
pricing or ordering change is required.

Evidence:

- `client/src/lib/productVisibility.test.ts`: four cases cover inactive admin
  reads, active/draft visibility, explicit editor access and guest column privacy.
  The inactive case failed before the fix (one failed, three passed).
- Node 20.20.2 `npm run ci`: 287 application tests, 41 authorization assertions,
  12 minimum-order and 13 reconfirmation assertions, type/storefront checks and
  production/PWA build passed.
- Actual ProductDetail/service browser fixtures passed in Chrome at 390×844 and
  1440×900: inactive PDP absent, active authenticated rates and ordering visible,
  no overflow, page errors or hosted requests. Fixtures use synthetic admin data;
  they are not hosted authenticated smoke tests. The initial harness timed out
  because it omitted Wouter's Route context; correcting the harness passed.

Deployment is the normal Pages code build; no SQL or settings change. Rollback
is a focused code revert, though that restores the admin storefront visibility
defect. Preserve database/RLS protections during any rollback.
