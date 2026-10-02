import { beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: globalThis.localStorage },
  });
});
import { asPacks, isOrderQtyValid } from "@/lib/orderingModel";
import {
  cartTotals,
  specOfCartItem,
  useCartStore,
  type CartItem,
} from "./cartStore";

const item: Omit<CartItem, "packs"> = {
  productId: "test",
  sku: "TEST",
  name: "Test box",
  price: 150,
  unit: "box",
  moq: 2,
  orderUnit: "pack",
  packSize: 100,
  orderStep: 300,
};
beforeEach(() => {
  useCartStore.persist.setOptions({
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  useCartStore.setState({ items: [], customer: { name: "", phone: "" } });
});
describe("shared cart step enforcement", () => {
  it("merges reorder atomically with fresh snapshots, retaining unrelated lines and customer", () => {
    const store = useCartStore.getState();
    store.addItem({ ...item, price: 999 }, asPacks(3));
    store.addItem({ ...item, productId: "unrelated" });
    store.setCustomer({ name: "Keep", phone: "123" });
    store.mergeReorder([{ ...item, price: 200, packs: asPacks(6) }]);
    expect(useCartStore.getState().items[0]).toMatchObject({
      price: 200,
      packs: 9,
    });
    expect(useCartStore.getState().items[1].productId).toBe("unrelated");
    expect(useCartStore.getState().customer.name).toBe("Keep");
    const before = useCartStore.getState().items;
    expect(() =>
      store.mergeReorder([
        { ...item, packs: asPacks(3) },
        { ...item, productId: "bad", packs: asPacks(0) },
      ])
    ).toThrow();
    expect(useCartStore.getState().items).toBe(before);
  });
  it.each(["pack", "pcs"] as const)(
    "adds and repeats %s products only in valid whole steps",
    orderUnit => {
      const store = useCartStore.getState();
      store.addItem({ ...item, orderUnit });
      expect(useCartStore.getState().items[0].packs).toBe(3);
      store.addItem({ ...item, orderUnit });
      const line = useCartStore.getState().items[0];
      expect(line.packs).toBe(6);
      expect(isOrderQtyValid(line.packs, specOfCartItem(line))).toBe(true);
      expect(cartTotals([line])).toMatchObject({
        total: 900,
        pieces: 600,
        anyInvalidQuantity: false,
      });
    }
  );
  it("snaps explicit pack/piece changes to the same ladder and permits removal", () => {
    const store = useCartStore.getState();
    store.addItem(item, asPacks(2));
    expect(useCartStore.getState().items[0].packs).toBe(3);
    store.setPacks("test", asPacks(5));
    expect(useCartStore.getState().items[0].packs).toBe(6);
    store.setPcs("test", 450);
    expect(useCartStore.getState().items[0].packs).toBe(6);
    store.setPacks("test", asPacks(0));
    expect(useCartStore.getState().items).toHaveLength(0);
  });
  it("flags off-step persisted quantities without silently changing customer selections", () => {
    const line = { ...item, packs: asPacks(4) };
    expect(cartTotals([line])).toMatchObject({
      anyBelowMoq: false,
      anyInvalidQuantity: true,
    });
    expect(line.packs).toBe(4);
  });
});
