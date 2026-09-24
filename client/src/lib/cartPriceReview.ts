import type { CartItem } from "@/stores/cartStore";

export type CartPriceChange = { productId: string; name: string; before: number; after: number };

export function reviewCartPrices(
  items: CartItem[],
  prices: { id: string; price: number | null }[]
): { items: CartItem[]; changes: CartPriceChange[] } {
  const byId = new Map(prices.map(p => [p.id, p.price]));
  const changes: CartPriceChange[] = [];
  const reviewed = items.map(item => {
    if (!byId.has(item.productId)) throw new Error("A cart product is no longer available");
    const raw = byId.get(item.productId);
    const price = raw == null ? 0 : Math.max(0, Number(raw));
    if (!Number.isFinite(price)) throw new Error("A product price could not be verified");
    if (price !== item.price || (price === 0) !== !!item.priceOnEnquiry) {
      changes.push({ productId: item.productId, name: item.name, before: item.price, after: price });
    }
    return { ...item, price, priceOnEnquiry: price === 0 };
  });
  return { items: reviewed, changes };
}

export function isCartPriceChanged(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && "message" in error
    && error.code === "P0001" && error.message === "CART_PRICE_CHANGED";
}
