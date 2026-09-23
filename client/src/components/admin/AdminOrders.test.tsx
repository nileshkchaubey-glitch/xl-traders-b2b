import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "@/lib/supabase";

vi.mock("@/lib/orderService", () => ({ orderService: {} }));

import { OrderRow } from "./AdminOrders";

const order: Order = {
  id: "synthetic-order",
  created_at: "2026-09-20T00:00:00Z",
  customer_name: "Test & Customer",
  phone: "9876543210",
  status: "new",
  total_amount: 2000,
  item_count: 1,
  notes: null,
  source: "web",
};

function renderPhone(phone: string | null) {
  return renderToStaticMarkup(
    <OrderRow order={{ ...order, phone }} onStatusChange={vi.fn()} />
  );
}

describe("admin order customer contact", () => {
  it.each(["9876543210", "+91 98765 43210", "919876543210"])(
    "addresses the displayed customer's number (%s), not the store",
    phone => {
      const html = renderPhone(phone);
      expect(html).toContain('href="https://wa.me/919876543210?text=');
      expect(html).not.toContain("wa.me/919773239442");
      expect(html).toContain(
        encodeURIComponent("Hi Test & Customer, your order has been received.")
      );
    }
  );

  it("preserves an explicitly international number", () => {
    expect(renderPhone("+44 7700 900123")).toContain(
      'href="https://wa.me/447700900123?text='
    );
  });

  it.each([null, "", "123", "9876543210 ext 5", "https://example.com"])(
    "does not create a misleading contact link for %s",
    phone => {
      expect(renderPhone(phone)).not.toContain("https://wa.me/");
    }
  );
});
