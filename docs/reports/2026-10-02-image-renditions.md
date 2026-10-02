# Original preservation and web image renditions

Before change, route and Image Library selection replaced the original with a
compressed JPEG, Workbench passed only a compressed WebP, categories uploaded
raw files and ProductImage could not use Storage renditions. Verified each call
path before replacing it with the existing storage/media service boundary.

Product, category, SKU, global Image Library and master uploads now keep the
selected File unchanged beside two browser-generated WebP files (maximum edge
800 and 1600 pixels; no enlargement). All encoding completes before uploading.
Fresh UUID stems and upsert:false preserve predecessor objects. Actual canvas
widths are encoded in the managed filename, so portrait and small images are
not mislabelled as 800/1600-wide. No new database columns or paid transforms.

ProductImage derives srcSet only for this managed convention and actual distinct
widths. Legacy external/Storage URLs remain single-source; Drive's real thumbnail
sizing remains. Originals and 2x companions are excluded from library/SKU choices;
existing legacy gallery files remain eligible. A partial failure returns no URL
and cleans only exact fresh keys successfully created by that attempt. Cleanup
failures are reported; there is no broad bucket deletion or predecessor overwrite.

Validation:

- Node 20.20.2 npm run ci: 215 application tests; 41 authorization, 12 minimum
  and 13 reconfirmation assertions; TypeScript, guardrails, build/PWA passed.
- Real Chrome at 390×844 and 1440×900, DPR 2: actual canvas encoding and shared
  upload functions exercised with synthetic Storage fixtures. Original SHA-256
  matched selected bytes; both outputs decoded as WebP. Landscape widths were
  800/1600, portrait 400/800 and small source 200/200. ProductImage loaded the
  actual captured file bytes with valid srcSet; the small source used one source.
  SKU listing exposed one primary image, and partial-failure cleanup was exact.
  Every production request was blocked; these are not hosted uploads.
- Live read-only bucket inspection: product-images/category-images are public,
  with no configured MIME/size overrides. Current Storage policies grant public
  read and require is_admin() for authenticated insert/update/delete. No policy
  or bucket change was required or performed.
- Initial Chrome launch was blocked by the sandbox; the authorized local check
  ran outside it. A first fixture attempt found the old Vite process stopped;
  its missing handle/refused local port were verified before starting a new one.

Hosted upload followed by bucket listing of the new files is NOT TESTED: valid
admin test Auth access is unavailable. Existing role tests and live policy
inspection do not replace that result. No production upload/delete or SQL change
was performed. Continue independent tasks while retaining this access limitation.

Deployment: normal Pages release after required checks, then verify the immutable
public catalogue/PDP on mobile/desktop. Rollback: revert this code PR; generated
1x URLs remain ordinary valid images on the older client. Keep their originals/
companions for recovery. Do not bulk-delete storage objects to roll back code.
