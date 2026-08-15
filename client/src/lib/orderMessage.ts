import {
  type CartItem,
  type CustomerInfo,
  cartTotals,
  specOfCartItem,
} from "@/stores/cartStore";
import { lineTotal, pcsFromPacks, pluralNoun } from "./orderingModel";

const money = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const qty = (n: number) => n.toLocaleString("en-IN");

/**
 * The quantity phrase for one line, in the customer's counting unit with the
 * picking unit in brackets:
 *
 *   pcs mode  →  "6,000 pcs (2 boxes)"
 *   pack mode →  "2 boxes"
 *
 * Both numbers are in the pcs form on purpose. The piece count is what the
 * customer asked for; the pack count is what gets picked off the shelf. A
 * fulfilment document that carried only one of them would force whoever packs
 * the order to redo the conversion by hand.
 */
export function lineQtyPhrase(item: CartItem): string {
  const spec = specOfCartItem(item);
  const packPhrase = `${qty(item.packs)} ${pluralNoun(spec.noun, item.packs)}`;
  return spec.unit === "pcs"
    ? `${qty(pcsFromPacks(item.packs, spec))} pcs (${packPhrase})`
    : packPhrase;
}

/**
 * The WhatsApp order message.
 *
 * ⚠️ THIS IS THE FULFILMENT DOCUMENT. The business packs and invoices against
 * this text, so every figure in it must equal what the customer saw in the
 * cart. That is not achieved by being careful — it is achieved by both surfaces
 * calling `cartTotals` and `lineTotal`, the same functions, on the same items.
 * Do not reintroduce a local reduce here.
 *
 * Kept free of any Supabase import so it stays unit-testable; `orderService`
 * re-exports it for existing callers.
 */
export function buildWhatsAppMessage(
  items: CartItem[],
  customer: CustomerInfo,
  notes?: string
): string {
  const t = cartTotals(items);

  const lines = items.map(item => {
    const amount = item.priceOnEnquiry
      ? "price on enquiry"
      : `₹${money(lineTotal(item.packs, item.price))}`;
    return `• ${item.name} — ${lineQtyPhrase(item)} — ${amount}`;
  });

  const out = [
    "🛒 *New Order — XL Traders*",
    `Customer: ${customer.name}`,
    `Phone: ${customer.phone}`,
    "──────────",
    ...lines,
    "──────────",
    // An all-enquiry cart has no meaningful rupee total; showing ₹0.00 would
    // read as "free" (the exact confusion priceUtils exists to prevent).
    t.allEnquiry ? "Total: Price on enquiry" : `*Total: ₹${money(t.total)}*`,
    `Items: ${t.lines} · Quantities: ${qty(t.pieces)} pcs`,
  ];

  if (notes?.trim()) {
    out.push("──────────", `Notes: ${notes.trim()}`);
  }

  return out.join("\n");
}
