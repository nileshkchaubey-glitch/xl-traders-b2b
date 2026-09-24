import { beforeEach, describe, expect, it, vi } from "vitest";
import { asPacks } from "./orderingModel";
import type { CartItem } from "@/stores/cartStore";

const { rpc, from, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), in: vi.fn(), eq: vi.fn() };
  return { rpc: vi.fn(), from: vi.fn(), query };
});
vi.mock("./supabase", () => ({ supabase: { rpc, from } }));
import { orderService } from "./orderService";

const item: CartItem = { productId: "p1", sku: "TEST", name: "Test pack", price: 125,
  packs: asPacks(8), unit: "pack", moq: 1, orderUnit: "pack", packSize: 10, orderStep: 10 };

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [{ id: "p1", price: 150 }], error: null });
});

describe("confirmed order service", () => {
  it("reads fresh active/published prices without creating an order", async () => {
    expect((await orderService.reviewPrices([item])).changes[0].after).toBe(150);
    expect(query.eq.mock.calls).toEqual([["status", "published"], ["is_active", true]]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends the exact price shown for each selling unit to the confirmed endpoint", async () => {
    rpc.mockResolvedValue({ data: "order-id", error: null });
    expect(await orderService.placeOrder([item], { name: " Test ", phone: "98765 43210" })).toBe("order-id");
    expect(rpc).toHaveBeenCalledWith("place_order_from_confirmed_cart", {
      p_customer_name: "Test", p_phone: "9876543210",
      p_items: [{ product_id: "p1", quantity: 8, expected_price: 125 }],
    });
  });
  it("propagates a stale-price rejection without automatic retry", async () => {
    const error = { code: "P0001", message: "CART_PRICE_CHANGED" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(orderService.placeOrder([item], { name: "Test", phone: "9876543210" })).rejects.toEqual(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("fails closed rather than falling back to the legacy endpoint before deployment", async () => {
    const error = { code: "PGRST202", message: "function not found" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(orderService.placeOrder([item], { name: "Test", phone: "9876543210" })).rejects.toEqual(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
