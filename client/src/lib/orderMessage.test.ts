import { describe, it, expect } from "vitest";
import { buildWhatsAppMessage, lineQtyPhrase } from "./orderMessage";
import { cartTotals, type CartItem } from "@/stores/cartStore";
import { asPacks, lineTotal } from "./orderingModel";

const item = (o: Partial<CartItem> = {}): CartItem => ({
  productId: "p1",
  sku: "SKU1",
  name: "Wooden Spoon",
  price: 4897,
  packs: asPacks(2),
  unit: "box",
  moq: 1,
  orderUnit: "pcs",
  packSize: 3000,
  orderStep: 3000,
  ...o,
});

const customer = { name: "Rajesh", phone: "9876543210" };

describe("lineQtyPhrase", () => {
  it("never pluralises a piece word as the selling unit (regression)", () => {
    // unit_of_measure is "pcs" on 138 of 139 live products. Passing it through
    // raw as the noun rendered "5 pcses" in the cart while the card said
    // "pack". The snapshot spec must apply the same sellingUnitNoun rule.
    expect(lineQtyPhrase(item({ orderUnit: "pack", unit: "pcs", packs: asPacks(5) })))
      .toBe("5 packs");
    expect(lineQtyPhrase(item({ orderUnit: "pack", unit: "nos", packs: asPacks(1) })))
      .toBe("1 pack");
  });

  it("leads with pieces and brackets the picking unit", () => {
    expect(lineQtyPhrase(item())).toBe("6,000 pcs (2 boxes)");
  });

  it("uses the selling unit alone in pack mode", () => {
    expect(lineQtyPhrase(item({ orderUnit: "pack", packs: asPacks(2) }))).toBe(
      "2 boxes"
    );
  });

  it("singularises one unit", () => {
    expect(lineQtyPhrase(item({ orderUnit: "pack", packs: asPacks(1) }))).toBe(
      "1 box"
    );
  });
});

describe("buildWhatsAppMessage", () => {
  it("renders the brief's line shape", () => {
    const msg = buildWhatsAppMessage([item()], customer);
    expect(msg).toContain("• Wooden Spoon — 6,000 pcs (2 boxes) — ₹9,794.00");
  });

  it("carries the customer and both headline counts", () => {
    const msg = buildWhatsAppMessage(
      [item(), item({ productId: "p2", name: "Napkin", packSize: 100, packs: asPacks(5), price: 200 })],
      customer
    );
    expect(msg).toContain("Customer: Rajesh");
    expect(msg).toContain("Phone: 9876543210");
    // 2 distinct products; 2×3000 + 5×100 = 6,500 pieces.
    expect(msg).toContain("Items: 2 · Quantities: 6,500 pcs");
  });

  it("appends notes only when there are notes", () => {
    expect(buildWhatsAppMessage([item()], customer, "  ")).not.toContain("Notes:");
    expect(buildWhatsAppMessage([item()], customer, "Gate 3")).toContain(
      "Notes: Gate 3"
    );
  });

  it("never prints ₹0 for an all-enquiry cart", () => {
    const msg = buildWhatsAppMessage(
      [item({ price: 0, priceOnEnquiry: true })],
      customer
    );
    expect(msg).toContain("price on enquiry");
    expect(msg).toContain("Total: Price on enquiry");
    expect(msg).not.toContain("₹0");
  });

  it("still totals the priced lines when only some are on enquiry", () => {
    const items = [
      item(),
      item({ productId: "p2", name: "Napkin", price: 0, priceOnEnquiry: true }),
    ];
    const msg = buildWhatsAppMessage(items, customer);
    expect(msg).toContain("*Total: ₹9,794.00*");
    expect(msg).toContain("price on enquiry");
  });
});

// ── The property that matters most ──────────────────────────────────────────
// The WhatsApp message is the document the business physically fulfils and
// invoices against. If it can disagree with the cart the customer approved,
// that is a dispute, not a rendering bug.
describe("invariant: the message total equals the cart total, always", () => {
  const carts: CartItem[][] = [
    [item()],
    [item(), item({ productId: "p2", name: "Napkin", packSize: 100, packs: asPacks(5), price: 200 })],
    [item({ price: 0, priceOnEnquiry: true })],
    [item(), item({ productId: "p3", name: "Foil", price: 0, priceOnEnquiry: true })],
    [item({ orderUnit: "pack", packSize: 1, packs: asPacks(7), price: 12.5 })],
    [],
  ];

  it("prints exactly the cartTotals figure for every cart shape", () => {
    for (const cart of carts) {
      const t = cartTotals(cart);
      const msg = buildWhatsAppMessage(cart, customer);
      if (t.allEnquiry || cart.length === 0) {
        if (t.allEnquiry) expect(msg).toContain("Total: Price on enquiry");
      } else {
        const printed = t.total.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        expect(msg).toContain(`*Total: ₹${printed}*`);
      }
    }
  });

  it("the sum of the printed line amounts equals the printed total", () => {
    for (const cart of carts.filter(c => c.length && !cartTotals(c).allEnquiry)) {
      const summed = cart.reduce((s, i) => s + lineTotal(i.packs, i.price), 0);
      expect(summed).toBeCloseTo(cartTotals(cart).total, 10);
    }
  });

  it("the piece count in the footer equals the sum of the line piece counts", () => {
    for (const cart of carts) {
      const byLine = cart.reduce((n, i) => n + i.packs * i.packSize, 0);
      expect(cartTotals(cart).pieces).toBe(byLine);
    }
  });
});
