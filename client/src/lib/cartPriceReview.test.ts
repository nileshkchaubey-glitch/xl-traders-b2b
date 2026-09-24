import { describe, expect, it } from "vitest";
import { asPacks } from "./orderingModel";
import { reviewCartPrices, isCartPriceChanged } from "./cartPriceReview";
import type { CartItem } from "@/stores/cartStore";

const item: CartItem = { productId: "p1", sku: "TEST", name: "Test pack", price: 125,
  priceOnEnquiry: false, packs: asPacks(8), unit: "pack", moq: 1,
  orderUnit: "pack", packSize: 10, orderStep: 10 };

describe("fresh cart prices", () => {
  it.each([100, 150, null, 0])("requires review when 125 changes to %s", price => {
    const result = reviewCartPrices([item], [{ id: "p1", price }]);
    expect(result.changes).toEqual([{ productId: "p1", name: "Test pack", before: 125, after: price ?? 0 }]);
    expect(result.items[0]).toMatchObject({ packs: 8, packSize: 10, price: price ?? 0, priceOnEnquiry: !price });
    expect(item.price).toBe(125);
  });
  it("requires review when an enquiry becomes priced", () => {
    expect(reviewCartPrices([{ ...item, price: 0, priceOnEnquiry: true }], [{ id: "p1", price: 125 }]).changes).toHaveLength(1);
  });
  it("does not prompt again for the same confirmed values", () => {
    expect(reviewCartPrices([item], [{ id: "p1", price: 125 }]).changes).toEqual([]);
  });
  it("fails closed when a product is unpublished or missing", () => {
    expect(() => reviewCartPrices([item], [])).toThrow("no longer available");
  });
  it("rejects non-finite prices", () => {
    expect(() => reviewCartPrices([item], [{ id: "p1", price: NaN }])).toThrow("could not be verified");
  });
  it("only treats the explicit database price rejection as recoverable", () => {
    expect(isCartPriceChanged({ code: "P0001", message: "CART_PRICE_CHANGED" })).toBe(true);
    expect(isCartPriceChanged({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isCartPriceChanged(new Error("network"))).toBe(false);
  });
});
