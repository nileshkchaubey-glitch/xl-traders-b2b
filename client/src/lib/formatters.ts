export function formatPrice(price: number | undefined | null): string {
  if (price == null) return "";
  return `₹${price.toLocaleString()}`;
}
