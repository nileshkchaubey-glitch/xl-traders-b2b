import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asPacks } from "@/lib/orderingModel";
import type { CartItem } from "@/stores/cartStore";

const { auth, cart } = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false },
  cart: {
    items: [] as CartItem[],
    customer: { name: "", phone: "" },
    setPacks: vi.fn(), removeItem: vi.fn(), setCustomer: vi.fn(), clearCart: vi.fn(),
  },
}));
vi.mock("@/lib/authStore", () => ({ useAuthStore: () => auth }));
vi.mock("@/lib/orderService", () => ({ orderService: { placeOrder: vi.fn() } }));
vi.mock("@/hooks/useMinOrder", () => ({
  useMinOrder: () => ({ enabled: true, value: 1000, loading: false }),
}));
vi.mock("@/stores/cartStore", async importOriginal => ({
  ...(await importOriginal<typeof import("@/stores/cartStore")>()),
  useCartStore: (selector: (state: typeof cart) => unknown) => selector(cart),
}));

import Cart from "./Cart";
import CartBar from "@/components/cart/CartBar";

beforeEach(() => {
  Object.assign(auth, { isAuthenticated: true, isLoading: false });
  cart.items = [{
    productId: "p1", sku: "TEST", name: "Test cups", price: 125,
    packs: asPacks(2), unit: "pack", moq: 1, orderUnit: "pack", packSize: 10,
    orderStep: 10, priceOnEnquiry: false,
  }];
  vi.clearAllMocks();
});

describe.each([
  ["cart page", Cart],
  ["floating cart bar", CartBar],
] as const)("%s price visibility", (_, Component) => {
  const render = () => renderToStaticMarkup(
    <Router ssrPath="/cart"><Component /></Router>
  );

  it("hides persisted rates, totals and monetary progress after sign-out", () => {
    expect(render()).toContain("₹250.00");
    auth.isAuthenticated = false;
    const html = render();
    expect(html).not.toContain("₹");
    expect(html).not.toContain("Minimum order met");
    expect(html).toContain("Sign in for rates");
    expect(cart.items[0]).toMatchObject({ price: 125, packs: 2 });
    expect(cart.clearCart).not.toHaveBeenCalled();
  });

  it("hides stored prices while authentication is unresolved", () => {
    auth.isLoading = true;
    expect(render()).not.toContain("₹");
  });

  it("preserves authenticated totals and minimum-order progress", () => {
    const html = render();
    expect(html).toContain("₹250.00");
    expect(html).toContain("₹750.00");
  });

  it("preserves on-enquiry display for signed-in buyers", () => {
    cart.items[0] = { ...cart.items[0], price: 0, priceOnEnquiry: true };
    expect(render()).toContain("On enquiry");
    expect(render()).not.toContain("₹0.00");
  });
});
