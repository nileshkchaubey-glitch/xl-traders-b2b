// Shared field validation for every product-editing surface.
//
// Extracted verbatim from CatalogTreeEditor's inline-cell editor (PR-A, the
// 25 Jul 2026 data-entry safety pass) so the Catalog Editor table and the
// Catalog Workbench cannot drift apart. The rules — and especially the
// messages — are the safety layer; reimplementing them per surface is how a
// typo silently wipes a price again.
//
// Rules that must not be weakened:
//   * Blank price is REFUSED, never coerced to NULL. "On Enquiry" is a
//     deliberate business decision with its own toggle; a cleared cell or a
//     typo must not reach it. (This is DE-01.)
//   * Number(), not parseFloat() — so "12abc" is rejected outright rather than
//     silently saved as 12.
//   * price <= 0 is refused; a stored ₹0 must never exist (lib/priceUtils.ts).
//
// Canonical unit-of-sale rule (CLAUDE.md): `price` is the price of ONE SELLING
// UNIT (the pack/case). `quantity_in_unit` is descriptive. `moq` counts selling
// units. Nothing here derives a per-piece rate — that stays a render concern.

export type EditableField =
  | "name"
  | "price"
  | "description"
  | "quantity_in_unit"
  | "moq"
  | "brand";

export type ValidationResult =
  | { patch: Record<string, unknown> }
  | { error: string };

export function isValidationError(
  result: ValidationResult
): result is { error: string } {
  return "error" in result;
}

// Shared by the numeric fields that count whole things (pack size, MOQ):
// blank is allowed and means "unknown" → NULL, but junk is refused.
function validatePositiveInt(
  value: string,
  column: string,
  label: string
): ValidationResult {
  const t = value.trim();
  if (t === "") return { patch: { [column]: null } };
  const n = Number(t);
  if (!Number.isFinite(n)) return { error: `${label} must be a number` };
  if (!Number.isInteger(n)) return { error: `${label} must be a whole number` };
  if (n <= 0) return { error: `${label} must be more than 0` };
  return { patch: { [column]: n } };
}

export function validateEdit(
  field: EditableField,
  value: string
): ValidationResult {
  if (field === "price") {
    const t = value.trim();
    if (t === "")
      return {
        error:
          'Price can\'t be blank — use the "Price on enquiry" toggle in the product panel',
      };
    const n = Number(t);
    if (!Number.isFinite(n))
      return { error: "Enter a valid price — numbers only" };
    if (n <= 0)
      return {
        error:
          'Price must be more than ₹0 — use the "Price on enquiry" toggle instead',
      };
    return { patch: { price: n } };
  }

  if (field === "name") {
    const t = value.trim();
    if (!t) return { error: "Name can't be empty" };
    return { patch: { name: t } };
  }

  if (field === "quantity_in_unit")
    return validatePositiveInt(value, "quantity_in_unit", "Pack quantity");

  if (field === "moq") return validatePositiveInt(value, "moq", "MOQ");

  if (field === "brand") {
    const t = value.trim();
    return { patch: { brand: t || null } };
  }

  // description
  return { patch: { description: value.trim() || null } };
}
