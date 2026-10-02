import { supabase, type Order, type OrderItem, type Product } from "./supabase";
import type { CartItem } from "@/stores/cartStore";
import { reorderPacks, resolveOrderSpec } from "./orderingModel";
import { cartLinePrice, isPriceOnEnquiry } from "./priceUtils";

export type CustomerOrder = Pick<
  Order,
  "id" | "created_at" | "status" | "total_amount"
> & {
  order_items: Pick<
    OrderItem,
    "product_id" | "product_name" | "quantity" | "unit_of_measure"
  >[];
};
const columns =
  "id,created_at,status,total_amount,order_items(product_id,product_name,quantity,unit_of_measure)";
const pageSize = 50;

async function requireUser(expectedUserId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== expectedUserId)
    throw new Error("Please sign in again");
  return data.user.id;
}

export const orderHistoryService = {
  async getPage(
    userId: string,
    offset = 0
  ): Promise<{ orders: CustomerOrder[]; total: number }> {
    await requireUser(userId);
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Invalid history page");
    const { data, error, count } = await supabase
      .from("orders")
      .select(columns, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    return {
      orders: (data ?? []) as CustomerOrder[],
      total: count ?? data?.length ?? 0,
    };
  },

  async prepareReorder(userId: string, orderId: string): Promise<CartItem[]> {
    await requireUser(userId);
    // Even admins using Account can only reorder their OWN customer orders.
    const { data: order, error } = await supabase
      .from("orders")
      .select(columns)
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Order not found");
    const lines = (order as CustomerOrder).order_items;
    if (!lines?.length) throw new Error("This order has no saved items");
    const ids = [
      ...new Set(
        lines.map(line => line.product_id).filter((id): id is string => !!id)
      ),
    ];
    const { data: products, error: productError } = await supabase
      .from("products")
      .select(
        "id,sku,name,price,image_url,unit_of_measure,quantity_in_unit,moq,order_unit,order_step"
      )
      .in("id", ids)
      .eq("status", "published")
      .eq("is_active", true);
    if (productError) throw productError;
    return lines.map(line => {
      const product = (products as Product[] | null)?.find(
        p => p.id === line.product_id
      );
      if (!product)
        throw new Error(
          `${line.product_name || "A saved product"} is no longer available. Your cart has not changed.`
        );
      if (product.price != null && !Number.isFinite(product.price))
        throw new Error("Could not verify current prices");
      const spec = resolveOrderSpec(product);
      return {
        productId: product.id,
        sku: product.sku ?? "",
        name: product.name,
        price: cartLinePrice(product.price),
        priceOnEnquiry: isPriceOnEnquiry(product.price),
        packs: reorderPacks(line.quantity, spec),
        unit: product.unit_of_measure || "pack",
        imageUrl: product.image_url || undefined,
        moq: spec.minPacks,
        orderUnit: spec.unit,
        packSize: spec.packSize,
        orderStep: spec.step,
      };
    });
  },
};
