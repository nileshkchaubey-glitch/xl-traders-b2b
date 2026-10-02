import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asPacks,
  isOrderQtyValid,
  reorderPacks,
  resolveOrderSpec,
} from "./orderingModel";
const { getUser, from, query } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  query: {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
    in: vi.fn(),
  },
}));
vi.mock("./supabase", () => ({ supabase: { auth: { getUser }, from } }));
import { orderHistoryService } from "./orderHistoryService";
const product = {
  id: "p",
  sku: "CURRENT",
  name: "Current box",
  price: 200,
  quantity_in_unit: 100,
  moq: 4,
  order_step: 300,
  order_unit: "pcs",
  unit_of_measure: "box",
};
const order = {
  order_items: [
    { product_id: "p", product_name: "Old box", quantity: 2, unit_price: 1 },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  from.mockReturnValue(query);
  for (const key of ["select", "eq", "order", "in"] as const)
    query[key].mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: order, error: null });
});
function currentProducts(products: unknown = [product], error: unknown = null) {
  query.eq.mockImplementation((key: string) =>
    key === "is_active" ? Promise.resolve({ data: products, error }) : query
  );
}
describe("user-scoped history and current-rule reorder", () => {
  it("queries only verified user's orders with explicit fields and bounded pagination", async () => {
    query.range.mockResolvedValue({ data: [], count: 51, error: null });
    expect(await orderHistoryService.getPage("u", 50)).toEqual({
      orders: [],
      total: 51,
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", "u");
    expect(query.range).toHaveBeenCalledWith(50, 99);
    expect(query.select.mock.calls[0][0]).not.toContain("*");
    expect(query.select.mock.calls[0][0]).not.toContain("phone");
  });
  it.each([null, { id: "another" }])(
    "blocks absent/different identity before any table call",
    async user => {
      getUser.mockResolvedValue({ data: { user }, error: null });
      await expect(orderHistoryService.getPage("u")).rejects.toThrow("sign in");
      await expect(
        orderHistoryService.prepareReorder("u", "o")
      ).rejects.toThrow("sign in");
      expect(from).not.toHaveBeenCalled();
    }
  );
  it("propagates Auth and query denial instead of showing fake history", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: Error("Auth denied"),
    });
    await expect(orderHistoryService.getPage("u")).rejects.toThrow(
      "Auth denied"
    );
    query.range.mockResolvedValue({ data: null, error: Error("RLS denied") });
    await expect(orderHistoryService.getPage("u")).rejects.toThrow(
      "RLS denied"
    );
  });
  it("re-reads owned order and current published+active product, ignoring historical rate", async () => {
    currentProducts();
    const result = await orderHistoryService.prepareReorder("u", "o");
    expect(query.eq.mock.calls).toEqual([
      ["id", "o"],
      ["user_id", "u"],
      ["status", "published"],
      ["is_active", true],
    ]);
    expect(result[0]).toMatchObject({
      productId: "p",
      name: "Current box",
      price: 200,
      packs: 6,
      moq: 6,
      packSize: 100,
      orderStep: 300,
      orderUnit: "pcs",
    });
    expect(
      isOrderQtyValid(result[0].packs, resolveOrderSpec(product as never))
    ).toBe(true);
  });
  it("refuses other user's/missing order", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(orderHistoryService.prepareReorder("u", "o")).rejects.toThrow(
      "not found"
    );
    expect(from).toHaveBeenCalledTimes(1);
  });
  it.each([null, []])(
    "blocks entire reorder when a product is deleted/draft/inactive/inaccessible",
    async products => {
      currentProducts(products);
      await expect(
        orderHistoryService.prepareReorder("u", "o")
      ).rejects.toThrow("no longer available");
    }
  );
  it("fails closed on current-product read errors", async () => {
    currentProducts(null, Error("Denied"));
    await expect(orderHistoryService.prepareReorder("u", "o")).rejects.toThrow(
      "Denied"
    );
  });
  it("preserves current enquiry semantics", async () => {
    currentProducts([{ ...product, price: null }]);
    expect(
      (await orderHistoryService.prepareReorder("u", "o"))[0]
    ).toMatchObject({ price: 0, priceOnEnquiry: true });
  });
  it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER])(
    "rejects unusable historic quantity %s",
    async quantity => {
      query.maybeSingle.mockResolvedValue({
        data: { order_items: [{ ...order.order_items[0], quantity }] },
        error: null,
      });
      currentProducts();
      await expect(
        orderHistoryService.prepareReorder("u", "o")
      ).rejects.toThrow();
    }
  );
  it("rounds up current pack/pcs steps and merges counts only inside orderingModel", () => {
    const spec = resolveOrderSpec(product as never);
    expect(reorderPacks(7, spec)).toBe(9);
    expect(reorderPacks(6, spec, 7)).toBe(15);
    expect(reorderPacks(2, spec)).toBe(6);
    expect(asPacks(6)).toBe(6);
  });
});
