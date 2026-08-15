import { supabase, Order, OrderItem, OrderStatus } from "./supabase";
import { CartItem, CustomerInfo, cartTotals } from "@/stores/cartStore";
import { lineTotal } from "./orderingModel";
// Re-exported so existing callers keep importing it from orderService; the
// implementation lives in orderMessage.ts, which is free of Supabase and
// therefore unit-testable.
export { buildWhatsAppMessage } from "./orderMessage";

export const orderService = {
  async placeOrder(items: CartItem[], customer: CustomerInfo): Promise<string> {
    // Same cartTotals the cart page and the WhatsApp message use, so the saved
    // order can never disagree with either.
    const t = cartTotals(items);
    const total = t.total;
    const itemCount = t.packs;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: customer.name,
        phone: customer.phone,
        status: "new",
        total_amount: total,
        item_count: itemCount,
        source: "cart",
      })
      .select("id")
      .single();

    if (orderError) throw orderError;
    const orderId = order.id as string;

    const orderItems = items.map(item => ({
      order_id: orderId,
      product_id: item.productId,
      sku: item.sku,
      product_name: item.name,
      // order_items.quantity is an integer column and counts SELLING UNITS —
      // the thing that gets picked off the shelf. Unchanged by pcs mode.
      quantity: item.packs,
      unit_price: item.price,
      unit_of_measure: item.unit,
      subtotal: lineTotal(item.packs, item.price),
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);
    if (itemsError) throw itemsError;

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
