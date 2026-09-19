import { supabase, Order, OrderItem, OrderStatus } from "./supabase";
import { CartItem, CustomerInfo } from "@/stores/cartStore";
// Re-exported so existing callers keep importing it from orderService; the
// implementation lives in orderMessage.ts, which is free of Supabase and
// therefore unit-testable.
export { buildWhatsAppMessage } from "./orderMessage";

export const orderService = {
  /**
   * The database is the authority for price, availability, MOQ and steps.
   * The browser sends only immutable product IDs and whole selling-unit counts;
   * one RPC inserts the order and every line atomically.
   */
  async placeOrder(items: CartItem[], customer: CustomerInfo): Promise<string> {
    const { data: orderId, error } = await supabase.rpc("place_order_from_cart", {
      p_customer_name: customer.name.trim(),
      p_phone: customer.phone.replace(/\s+/g, ""),
      p_items: items.map(item => ({
        product_id: item.productId,
        quantity: item.packs,
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
