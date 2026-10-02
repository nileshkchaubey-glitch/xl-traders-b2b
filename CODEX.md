# XL Traders B2B — product and working agreement

Latest owner instructions take precedence. Read [AGENTS](AGENTS.md),
[CLAUDE](CLAUDE.md), current code and [launch status](docs/LAUNCH_STATUS.md).
The full earlier blueprint is preserved in the archive.

The product is a solo-operated B2B packaging catalogue and storefront. `/admin`
is the only PIM; CatalogTreeEditor is the main products surface. Do not create
Admin-v2, a competing product editor or speculative supplier/seasonal systems.

Keep fast catalogue entry separate from deep editing. Reuse the shared
useProductForm/productForm save path, category/brand pickers, image section,
DataTable and service methods. Do not fork SKU, validation, price typing or
image assignment behavior. Brand identity and public copy require actual
catalogue/owner facts; prototype examples do not establish business claims.

The approved launch work follows verify → implement → focused tests/full CI →
self-review → focused PR → green checks → authorized merge → main/deployment
verification. No prototype approval is needed again for already authorized
implementation. A new business policy, pricing decision or scope change still
needs the owner. Report an access blocker and continue independent tasks.

Production SQL is authorized for reviewed launch tasks under inspection,
rollback preservation, disposable validation and post-change verification.
Real customer/catalogue/order data and core tables/buckets must be preserved.
Never reconcile the 11 Hinged Box prices automatically or delete uncategorized.
The old broad 'expendable catalogue' and blanket 'owner-only SQL' instructions
are superseded. No paid service or infrastructure may be introduced.

The design reference determines geometry, hierarchy and density, not stock,
rates, discounts, delivery or freight promises. Compare rendered mobile/desktop
screens with existing components/tokens; preserve guest privacy and keyboard UX.
See [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md), [STOREFRONT_RULES](docs/STOREFRONT_RULES.md)
and [ORDERING_MODEL](docs/ORDERING_MODEL.md) for the implementation constraints.
