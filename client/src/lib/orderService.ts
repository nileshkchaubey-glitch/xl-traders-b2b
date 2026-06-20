import { supabase, Order, OrderItem, OrderStatus } from "./supabase";
import { CartItem, CustomerInfo } from "@/stores/cartStore";

export const orderService = {
  async placeOrder(items: CartItem[], customer: CustomerInfo): Promise<string> {
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);

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
      quantity: item.quantity,
      unit_price: item.price,
      unit_of_measure: item.unit,
      subtotal: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);
    if (itemsError) throw itemsError;

    return orderId;
  },

  buildWhatsAppMessage(items: CartItem[], customer: CustomerInfo): string {
    const lines = items.map(i =>
      i.priceOnEnquiry
        ? `${i.quantity} x ${i.name} — price on enquiry`
        : `${i.quantity} x ${i.name} — ₹${(i.price * i.quantity).toLocaleString()}`
    );
    const total = items.reduce(
      (s, i) => s + (i.priceOnEnquiry ? 0 : i.price * i.quantity),
      0
    );
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    // When every line is price-on-enquiry there is no meaningful rupee total —
    // show "Price on enquiry" instead of a misleading ₹0.
    const allEnquiry = items.length > 0 && items.every(i => i.priceOnEnquiry);
    const totalLine = allEnquiry
      ? "Total: Price on enquiry"
      : `Total: ₹${total.toLocaleString()}`;

    return [
      "🛒 New Order from XL Traders",
      `Customer: ${customer.name}`,
      `Phone: ${customer.phone}`,
      "──────────",
      ...lines,
      "──────────",
      totalLine,
      `Items: ${itemCount}`,
    ].join("\n");
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
