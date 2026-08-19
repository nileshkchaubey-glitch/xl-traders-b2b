import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, MessageCircle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import ProductImage from "@/components/storefront/ProductImage";
import QtyStepper from "@/components/storefront/QtyStepper";
import { MoqChip } from "@/components/storefront/ProductMeta";

import {
  useCartStore,
  cartTotals,
  specOfCartItem,
  type CartItem,
} from "@/stores/cartStore";
import { orderService } from "@/lib/orderService";
import { buildWhatsAppMessage } from "@/lib/orderMessage";
import { useMinOrder } from "@/hooks/useMinOrder";
import {
  type Packs,
  formatOrderQty,
  lineTotal,
  pluralNoun,
} from "@/lib/orderingModel";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

const money = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Cart() {
  const [, setLocation] = useLocation();
  const items = useCartStore(s => s.items);
  const customer = useCartStore(s => s.customer);
  const setPacks = useCartStore(s => s.setPacks);
  const removeItem = useCartStore(s => s.removeItem);
  const setCustomer = useCartStore(s => s.setCustomer);
  const clearCart = useCartStore(s => s.clearCart);

  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState("");
  const minOrder = useMinOrder();

  // ONE source for every figure on this page — and the same one the WhatsApp
  // message uses, so the two can never disagree.
  const t = cartTotals(items);

  const belowMinOrder =
    minOrder.enabled && !t.allEnquiry && t.total < minOrder.value;
  const minOrderShort = belowMinOrder ? minOrder.value - t.total : 0;

  /**
   * A stepper change. `orderingModel` returns 0 when a decrement would go under
   * the line's MOQ, which is the signal to REMOVE the line — with a message
   * saying why, rather than silently dropping it or silently allowing an
   * invalid quantity through to fulfilment.
   */
  const handleQty = (item: CartItem, next: Packs) => {
    if (next > 0) {
      setPacks(item.productId, next);
      return;
    }
    const spec = specOfCartItem(item);
    removeItem(item.productId);
    toast.info(`${item.name} removed`, {
      description:
        spec.unit === "pcs"
          ? `Minimum order is ${spec.minPcs.toLocaleString("en-IN")} pcs.`
          : `Minimum order is ${spec.minPacks} ${pluralNoun(spec.noun, spec.minPacks)}.`,
    });
  };

  const handlePlaceOrder = async () => {
    if (!items.length) return toast.error("Your cart is empty");
    if (t.anyBelowMoq)
      return toast.error("Some lines are below their minimum order quantity");
    if (minOrder.loading)
      return toast.error("Checking order settings — try again in a moment");
    if (belowMinOrder)
      return toast.error(
        `Add ₹${money(minOrderShort)} more to meet the minimum order value`
      );
    if (!customer.name.trim()) return toast.error("Please enter your name");
    if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/\s+/g, "")))
      return toast.error("Please enter a valid 10-digit Indian mobile number");

    setPlacing(true);
    try {
      await orderService.placeOrder(items, customer);
      const message = buildWhatsAppMessage(items, customer, notes);
      window.open(
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
      clearCart();
      setNotes("");
      toast.success("Order placed — opening WhatsApp");
      setLocation("/");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <main className="flex-1 pb-28 md:pb-10">
      <div className="xl-shell py-6">
        <h1 className="mb-5 text-2xl font-extrabold tracking-tight">
          Your Cart
          {t.lines > 0 && (
            <span className="ml-2 text-sm font-semibold text-slate-500">
              {t.lines} item{t.lines !== 1 ? "s" : ""} ·{" "}
              {t.pieces.toLocaleString("en-IN")} quantities
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <ShoppingCart size={26} className="mx-auto mb-3 text-slate-400" />
            <div className="mb-1.5 text-base font-bold">Your cart is empty</div>
            <Link href="/catalog" className="font-bold text-red-600">
              Browse the catalogue →
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
            {/* ── Lines ── */}
            <div className="flex flex-col gap-3">
              {items.map(item => {
                const spec = specOfCartItem(item);
                const label = formatOrderQty(item.packs, spec);
                const below = item.packs < item.moq;
                return (
                  <div
                    key={item.productId}
                    className={`flex items-center gap-3.5 rounded-2xl border bg-white p-3.5 ${
                      below ? "border-red-300" : "border-slate-200"
                    }`}
                  >
                    <Link
                      href={`/product/${item.productId}`}
                      className="w-[72px] flex-shrink-0 overflow-hidden rounded-xl border border-slate-100"
                    >
                      <ProductImage
                        url={item.imageUrl}
                        alt={item.name}
                        slotPx={140}
                        aspect="aspect-square"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${item.productId}`}
                        className="line-clamp-2 text-body-sm font-bold hover:text-red-600"
                      >
                        {item.name}
                      </Link>

                      {/* Pieces lead; the pack breakdown sits beneath. */}
                      <div className="mt-1 text-body-md font-extrabold tabular-nums text-slate-900">
                        {label.primary}
                      </div>
                      {label.secondary && (
                        <div className="text-caption text-slate-500 tabular-nums">
                          {label.secondary}
                        </div>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <MoqChip spec={spec} />
                        <span className="text-caption text-slate-500 tabular-nums">
                          {item.priceOnEnquiry
                            ? "Price on enquiry"
                            : `₹${money(item.price)} / ${spec.noun}`}
                        </span>
                      </div>

                      {below && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11.5px] font-bold text-red-700">
                          Below minimum —{" "}
                          {spec.unit === "pcs"
                            ? `${spec.minPcs.toLocaleString("en-IN")} pcs`
                            : `${spec.minPacks} ${pluralNoun(spec.noun, spec.minPacks)}`}{" "}
                          required
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <QtyStepper
                        packs={item.packs}
                        spec={spec}
                        onChange={next => handleQty(item, next)}
                      />
                      <div className="text-body-md font-extrabold tabular-nums">
                        {item.priceOnEnquiry
                          ? "—"
                          : `₹${money(lineTotal(item.packs, item.price))}`}
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-slate-400 transition hover:text-red-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="mb-1.5 block text-caption font-bold uppercase tracking-wide text-slate-500">
                  Order notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Delivery instructions, GSTIN, preferred time…"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-body-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            {/* ── Summary ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
              <h2 className="mb-3 font-extrabold">Order summary</h2>

              <dl className="space-y-1.5 text-body-sm">
                <Row k="Items" v={String(t.lines)} />
                <Row
                  k="Quantities"
                  v={`${t.pieces.toLocaleString("en-IN")} pcs`}
                />
                <Row
                  k="Selling units"
                  v={`${t.packs.toLocaleString("en-IN")}`}
                />
              </dl>

              <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="font-bold">Total</span>
                <span className="text-xl font-extrabold tabular-nums">
                  {t.allEnquiry ? "On enquiry" : `₹${money(t.total)}`}
                </span>
              </div>

              {belowMinOrder && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-caption font-semibold text-amber-800">
                  Add ₹{money(minOrderShort)} more to meet the minimum order
                  value of ₹{money(minOrder.value)}.
                </p>
              )}

              <div className="mt-4 space-y-2.5">
                <input
                  value={customer.name}
                  onChange={e =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                  placeholder="Your name"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-body-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
                />
                <input
                  value={customer.phone}
                  onChange={e =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-body-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placing || t.anyBelowMoq}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-body-md font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {placing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageCircle size={16} />
                )}
                Send order on WhatsApp
              </button>

              <p className="mt-2 text-center text-caption text-slate-500">
                Order is saved and confirmed on WhatsApp · GST invoice included
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold tabular-nums">{v}</dd>
    </div>
  );
}
