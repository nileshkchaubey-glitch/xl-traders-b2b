/**
 * Strictly parse a spreadsheet number. parseFloat/parseInt silently accept
 * prefixes such as "12abc"; imports must reject them rather than alter prices.
 */
export function parseOptionalImportNumber(
  raw: unknown,
  field: string,
  options: { integer?: boolean; positive?: boolean; nonNegative?: boolean } = {}
): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;

  const text = String(raw).trim();
  const valid =
    /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d+)?$/.test(text);
  if (!valid) throw new Error(`Invalid ${field} — must be a valid number`);

  const value = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(value)) throw new Error(`Invalid ${field} — must be a valid number`);
  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`Invalid ${field} — must be a whole number`);
  }
  if (options.positive && value <= 0) {
    throw new Error(`Invalid ${field} — must be greater than zero`);
  }
  if (options.nonNegative && value < 0) {
    throw new Error(`Invalid ${field} — cannot be negative`);
  }
  return value;
}
