// Single source of truth for the "is this a real brand?" rule.
//
// 'Generic' is a null-brand placeholder left over from data entry, not a
// supplier we actually stock. It must NEVER render as a brand anywhere —
// product cards, product detail, the Home "Brands We Stock" list, or the
// marquee — and is treated exactly like NULL. Same shape as priceUtils'
// isPriceOnEnquiry: one rule, one place, every render site funnels through it.
//
// Supplier names we DO stock (Fortune Petpack, Packworld) render as plain
// text. See docs/STYLE_REFERENCE.md §4.4.
//
// Note this is a *presentation* rule: productService.getBrands() still returns
// whatever the column holds, so the admin PIM keeps seeing 'Generic' as the
// stored value it is.
export function brandLabel(brand?: string | null): string | null {
  const trimmed = brand?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === "generic" ? null : trimmed;
}

// List form, for the surfaces that render a set of brands.
export function realBrands(brands: string[]): string[] {
  return brands.map(brandLabel).filter((b): b is string => b !== null);
}
