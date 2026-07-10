// Single source of truth for the "price on enquiry" rule.
//
// A B2B price is shown "on enquiry" (Price on request) whenever it is not a
// real, positive number: NULL/undefined OR zero/negative. A stored 0 is treated
// exactly like NULL — it must NEVER render as "₹0" anywhere (cards, detail,
// cart, WhatsApp, admin lists). Every price render/consume site funnels through
// this helper so the rule lives in one place.
//
// (The catalogue previously overloaded 0 to mean "free"; that semantic is
// retired — 0 now means enquiry, and existing 0 rows are migrated to NULL.)
export function isPriceOnEnquiry(price?: number | null): boolean {
  return price == null || price <= 0;
}

// The amount a cart line should carry: 0 for on-enquiry items (so totals never
// count a bogus price), otherwise the real price.
export function cartLinePrice(price?: number | null): number {
  return isPriceOnEnquiry(price) ? 0 : (price as number);
}
