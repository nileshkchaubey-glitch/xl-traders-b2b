# Existing pg_trgm index and current search measurements

Verified live on 2 October against main a540a3be7af7a3be84df43256fea6080ad169c39.
pg_trgm 1.6 exists in public. products_name_trgm is ready and valid:

```sql
CREATE INDEX products_name_trgm ON public.products USING gin (name gin_trgm_ops);
```

The catalogue has 143 rows, of which 139 are published+active. This satisfies
the existing name-index item; no duplicate migration/index was written, no index
was dropped/rebuilt and no grants, publication gates or catalogue data changed.
Historical handoff pending/owner-only SQL instructions do not describe current
implementation or latest owner authorization.

Source verification: productService.search/applyPublicScalarFilters match name
OR description OR sku through the shared quoted orIlike helper; public queries
apply status=published/is_active=true. The name index alone does not index all
three OR arms. Changing search semantics or adding more indexes is not justified
by the current measured dataset and is outside this verification.

Read-only EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) measurements used only id/name,
explicit public gates and these representative predicates. SQL ran through the
trusted inspection connection, not an anonymous JWT; separate browser checks
below verify actual anonymous responses. Planning and execution are separate.

| Query                                                    | Rows | Plan                                                            | Planning ms | Execution ms | Shared hit/read blocks |
| -------------------------------------------------------- | ---: | --------------------------------------------------------------- | ----------: | -----------: | ---------------------- |
| box across name/description/sku, display_order, limit 24 |   17 | Seq Scan → Sort → Limit                                         |      25.969 |        0.565 | 19 / 0                 |
| cup across name/description/sku, display_order, limit 24 |    7 | Seq Scan → Sort → Limit                                         |       2.971 |        0.558 | 19 / 0                 |
| name-only box, limit 24                                  |   17 | Bitmap Index Scan products_name_trgm → Bitmap Heap Scan → Limit |       2.794 |        4.415 | 12 / 0                 |

Exact query forms:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, name FROM public.products
WHERE is_active AND status='published'
  AND (name ILIKE '%box%' OR description ILIKE '%box%' OR sku ILIKE '%box%')
ORDER BY display_order ASC LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, name FROM public.products
WHERE is_active AND status='published'
  AND (name ILIKE '%cup%' OR description ILIKE '%cup%' OR sku ILIKE '%cup%')
ORDER BY display_order ASC LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, name FROM public.products
WHERE is_active AND status='published' AND name ILIKE '%box%' LIMIT 24;
```

These are single current-state samples, not a statistical benchmark. They are
different queries and must not be compared as a speedup. A historical no-index
baseline is unavailable because the requested index was already installed;
removing it to invent a before/after would redo completed work. No before/after
gain is claimed. Small-table sequential scans of the current three-column search
are not a verified launch blocker; name-only use proves the installed index is
usable. All sampled shared read/write/dirty and temporary write counters were
zero except reported cache hits; no query wrote catalogue/customer data.

Actual anonymous Chrome checks used immutable deployment
https://02f0de28.xl-traders-b2b.pages.dev at 390×844 and 1440×900:

| Viewport | Term    | HTTP | Rows | Observed API response ms |
| -------- | ------- | ---: | ---: | -----------------------: |
| mobile   | box     |  200 |   17 |                  860.314 |
| mobile   | cup     |  200 |    7 |                  510.989 |
| mobile   | cup,box |  200 |    0 |                  221.013 |
| desktop  | box     |  200 |   17 |                  276.431 |
| desktop  | cup     |  200 |    7 |                  201.137 |
| desktop  | cup,box |  200 |    0 |                  197.361 |

Timing includes the browser/API network path and cannot be attributed to SQL
execution or the index. Every response omitted protected price/MRP/bulk fields;
no overflow or page error. The comma term stayed literal instead of returning
HTTP 400. No write, login, customer/catalogue fixture or WhatsApp send occurred.

Current supported npm run ci on Node 20.20.2 passed: 252 application tests,
41 authorization, 12 minimum-order and 13 reconfirmation checks; TypeScript,
storefront guardrails and production/PWA build. This PR changes evidence only.
Deploy/rollback: normal documentation-only release/revert, no SQL to apply.
Re-measure representative full queries when genuine catalogue growth justifies
performance work; do not force planner settings or remove an existing index.
