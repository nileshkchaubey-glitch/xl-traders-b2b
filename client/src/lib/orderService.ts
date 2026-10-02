import { supabase, Order, OrderItem, OrderStatus } from "./supabase";
import { CartItem, CustomerInfo, cartTotals } from "@/stores/cartStore";
import { reviewCartPrices } from "./cartPriceReview";
import { buildGuestCartMessage } from "./orderMessage";
// Re-exported so existing callers keep importing it from orderService; the
// implementation lives in orderMessage.ts, which is free of Supabase and
// therefore unit-testable.
export { buildWhatsAppMessage } from "./orderMessage";

export const orderService = {
  /** No catalogue/price query or order write: this is a guest enquiry only. */
  prepareGuestCart(items: CartItem[], customer: CustomerInfo, notes?: string): string {
    if (!items.length) throw new Error("Your cart is empty");
    if (cartTotals(items).anyBelowMoq) {
      throw new Error("Some lines are below their minimum order quantity");
    }
    return buildGuestCartMessage(items, customer, notes);
  },
  async reviewPrices(items: CartItem[]) {
    const { data, error } = await supabase.from("products")
      .select("id,price").in("id", items.map(item => item.productId))
      .eq("status", "published").eq("is_active", true);
    if (error) throw error;
    return reviewCartPrices(items, data ?? []);
  },
  /**
   * The database is the authority for price, availability, MOQ and steps.
   * The browser sends product IDs, whole selling-unit counts and the price the
   * customer confirmed. The RPC rejects stale prices and inserts atomically.
   */
  async placeOrder(items: CartItem[], customer: CustomerInfo): Promise<string> {
    const { data: orderId, error } = await supabase.rpc("place_order_from_confirmed_cart", {
      p_customer_name: customer.name.trim(),
      p_phone: customer.phone.replace(/\s+/g, ""),
      p_items: items.map(item => ({
        product_id: item.productId,
        quantity: item.packs,
        expected_price: item.price,
      })),
    });

    if (error) throw error;
    if (typeof orderId !== "string" || !orderId) {
      throw new Error("Order creation returned no order ID");
    }

    return orderId;
  },

  async getAll(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Order[]) ?? [];
  },

  async getItems(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);
    if (error) throw error;
    return (data as OrderItem[]) ?? [];
  },

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (error) throw error;
  },
};
