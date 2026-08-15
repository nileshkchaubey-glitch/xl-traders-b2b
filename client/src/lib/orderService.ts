import { supabase, Order, OrderItem, OrderStatus } from "./supabase";
import { CartItem, CustomerInfo, specOfCartItem } from "@/stores/cartStore";
import { lineTotal, pcsFromPacks, pluralNoun } from "./orderingModel";

export const orderService = {
  async placeOrder(items: CartItem[], customer: CustomerInfo): Promise<string> {
    // Money is packs × price, and lineTotal is the only thing that multiplies.
    const total = items.reduce((s, i) => s + lineTotal(i.packs, i.price), 0);
    const itemCount = items.reduce((s, i) => s + i.packs, 0);

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

  buildWhatsAppMessage(items: CartItem[], customer: CustomerInfo): string {
    // This message is a manual-fulfilment document, so a pcs line carries BOTH
    // the piece count (what the customer asked for) and the pack count (what
    // gets picked off the shelf) rather than choosing between them.
    // A pack line is byte-identical to what shipped before (ORDERING_MODEL §8.5).
    const lines = items.map(i => {
      const spec = specOfCartItem(i);
      const qty =
        spec.unit === "pcs"
          ? `${pcsFromPacks(i.packs, spec).toLocaleString()} pcs (${i.packs} ${pluralNoun(spec.noun, i.packs)} × ${spec.packSize.toLocaleString()})`
          : `${i.packs}`;
      return i.priceOnEnquiry
        ? `${qty} x ${i.name} — price on enquiry`
        : `${qty} x ${i.name} — ₹${lineTotal(i.packs, i.price).toLocaleString()}`;
    });
    const total = items.reduce(
      (s, i) => s + (i.priceOnEnquiry ? 0 : lineTotal(i.packs, i.price)),
      0
    );
    const itemCount = items.reduce((s, i) => s + i.packs, 0);
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
