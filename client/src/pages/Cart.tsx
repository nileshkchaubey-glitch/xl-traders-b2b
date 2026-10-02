import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, MessageCircle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import PageTitleBar from "@/components/storefront/PageTitleBar";
import ProductImage from "@/components/storefront/ProductImage";
import QtyStepper from "@/components/storefront/QtyStepper";
import { MoqChip } from "@/components/storefront/ProductMeta";

import {
  useCartStore,
  cartTotals,
  specOfCartItem,
  type CartItem,
} from "@/stores/cartStore";
import { useAuthStore } from "@/lib/authStore";
import { orderService } from "@/lib/orderService";
import { buildWhatsAppMessage } from "@/lib/orderMessage";
import {
  isCartPriceChanged,
  type CartPriceChange,
} from "@/lib/cartPriceReview";
import { useMinOrder } from "@/hooks/useMinOrder";
import {
  type Packs,
  formatOrderQty,
  lineTotal,
  pluralNoun,
  isOrderQtyValid,
} from "@/lib/orderingModel";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

const money = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Cart() {
  const { isAuthenticated, isLoading } = useAuthStore();
  // Persisted carts can still contain a prior session's price snapshot.
  const canViewPrices = isAuthenticated && !isLoading;
  const [, setLocation] = useLocation();
  const items = useCartStore(s => s.items);
  const customer = useCartStore(s => s.customer);
  const setPacks = useCartStore(s => s.setPacks);
  const removeItem = useCartStore(s => s.removeItem);
  const setCustomer = useCartStore(s => s.setCustomer);
  const clearCart = useCartStore(s => s.clearCart);
  const updatePrices = useCartStore(s => s.updatePrices);

  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState("");
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([]);
  const minOrder = useMinOrder();

  // ONE source for every figure on this page — and the same one the WhatsApp
  // message uses, so the two can never disagree.
  const t = cartTotals(items);
  const totalLabel = !canViewPrices
    ? "Sign in for rates"
    : t.allEnquiry
      ? "On enquiry"
      : `₹${money(t.total)}`;

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
    if (placing) return;
    if (!canViewPrices) {
      toast.error("Please sign in to place an order");
      setLocation("/auth");
      return;
    }
    if (!items.length) return toast.error("Your cart is empty");
    if (t.anyInvalidQuantity)
      return toast.error(
        "Some quantities do not meet their minimum order quantity or order step"
      );
    if (minOrder.loading)
      return toast.error("Checking order settings — try again in a moment");
    if (!customer.name.trim()) return toast.error("Please enter your name");
    if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/\s+/g, "")))
      return toast.error("Please enter a valid 10-digit Indian mobile number");

    setPlacing(true);
    try {
      const review = await orderService.reviewPrices(items);
      if (review.changes.length) {
        updatePrices(review.items);
        setPriceChanges(review.changes);
        toast.info(
          "Prices changed. Review the updated amounts and confirm again."
        );
        return;
      }
      if (belowMinOrder) {
        toast.error(
          `Add ₹${money(minOrderShort)} more to meet the minimum order value`
        );
        return;
      }
      await orderService.placeOrder(review.items, customer);
      const message = buildWhatsAppMessage(review.items, customer, notes);
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
      if (isCartPriceChanged(err)) {
        // A price changed between the fresh read and the locked database check.
        // Never retry the order automatically or clear the customer's cart.
        try {
          const review = await orderService.reviewPrices(items);
          updatePrices(review.items);
          setPriceChanges(review.changes);
        } catch {
          toast.error(
            "Could not refresh prices. Your cart is saved; please try again."
          );
          return;
        }
        toast.info(
          "Prices changed before the order was saved. Review and confirm again."
        );
        return;
      }
      console.error(err);
      toast.error(
        "Could not verify or save your order. Your cart is saved; please try again."
      );
    } finally {
      setPlacing(false);
    }
  };

  const handleGuestWhatsApp = () => {
    if (isLoading || isAuthenticated) return;
    try {
      const message = orderService.prepareGuestCart(items, customer, notes);
      window.open(
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
      // Keep quantities for sign-in. This action does not create a saved order.
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not prepare your cart"
      );
    }
  };

  return (
    <main className="flex-1 pb-28 md:pb-10">
      <div className="xl-shell py-6">
        {/* Shared with /catalog — see PageTitleBar. This replaces an `<h1>`
            that CONTAINED the item count, so a screen reader announced
            "Your Cart1 item · 3,360 quantities" as the page heading. The count
            is a sibling `<p>` now. */}
        <PageTitleBar
          title="Your cart"
          sub={
            t.lines > 0
              ? `${t.lines} item${t.lines !== 1 ? "s" : ""} · ${t.pieces.toLocaleString("en-IN")} pcs`
              : undefined
          }
          backLabel="Back to shopping"
          actions={
            items.length > 0 && (
              <Link
                href="/catalog"
                className="hidden flex-shrink-0 text-product-name-lg font-bold text-red-600 transition-colors hover:text-red-700 lg:block"
              >
                Continue shopping
              </Link>
            )
          }
        />

        {/* C-2 — the prototype's guest banner. The second sentence is the
            load-bearing one: a guest filling a cart they cannot price needs to
            know the quantities survive sign-in, or there is no reason to keep
            going. Guest only, and only with something in the cart. */}
        {!isAuthenticated && items.length > 0 && (
          <div className="mb-3.5 rounded-2xl border border-amber-100 bg-amber-50 p-[13px] lg:p-4">
            <p className="text-caption font-semibold leading-[1.55] text-amber-800 lg:text-product-name">
              Rates and order total are visible once you sign in. Quantities you
              set now are kept.
            </p>
            <Link
              href="/auth"
              className="mt-2.5 inline-block rounded-[10px] bg-red-600 px-[18px] py-[11px] text-product-name font-extrabold text-white transition-colors hover:bg-red-700 lg:text-product-name-lg"
            >
              Sign in
            </Link>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <ShoppingCart size={26} className="mx-auto mb-3 text-slate-400" />
            <div className="mb-1.5 text-base font-bold">Your cart is empty</div>
            <Link href="/catalog" className="font-bold text-red-600">
              Browse the catalogue →
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
            {/* ── Lines ── */}
            <div className="flex flex-col gap-3">
              {items.map(item => {
                const spec = specOfCartItem(item);
                const label = formatOrderQty(item.packs, spec);
                const below = !isOrderQtyValid(item.packs, spec);
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

                      {/* C-3 — the prototype's line meta reads
                          "100 pcs/pack · MOQ 700 pcs · 7 packs". Pack size is
                          added here; it comes from the line's own snapshot, so
                          it cannot drift from what was priced.

                          The prototype also leads the line with a BRAND
                          eyebrow. Not built: `CartItem` carries no brand, and
                          adding one means snapshotting it at add-time and
                          bumping the persisted store version — which discards
                          every cart in progress. That is a store change, not a
                          layout one. Recorded, not quietly skipped. */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <MoqChip spec={spec} />
                        {spec.packSize > 1 && (
                          <span className="text-caption text-slate-500 tabular-nums">
                            {spec.packSize.toLocaleString("en-IN")} pcs/
                            {spec.noun}
                          </span>
                        )}
                        <span className="text-caption text-slate-500 tabular-nums">
                          {!canViewPrices
                            ? "Sign in for rates"
                            : item.priceOnEnquiry
                              ? "Price on enquiry"
                              : `₹${money(item.price)} / ${spec.noun}`}
                        </span>
                      </div>

                      {below && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11.5px] font-bold text-red-700">
                          Check quantity — minimum{" "}
                          {spec.unit === "pcs"
                            ? `${spec.minPcs.toLocaleString("en-IN")} pcs`
                            : `${spec.minPacks} ${pluralNoun(spec.noun, spec.minPacks)}`}{" "}
                          required; use the stepper to select a valid step.
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
                        {!canViewPrices || item.priceOnEnquiry
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
            <div
              id="order-summary"
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24"
            >
              {/* C-5 — the prototype's summary heading is a band, not a bare
                  heading: #f8fafc, 12/800, padding 10/13, bottom border. The
                  card's own p-4 is cancelled with a negative margin so the
                  band reaches the card edges. */}
              <h2 className="-mx-4 -mt-4 mb-3 border-b border-slate-200 bg-slate-50 px-[13px] py-2.5 text-product-name-lg font-extrabold text-slate-900">
                Order summary
              </h2>

              {/* C-4 — the prototype's rows are Subtotal / Freight / Total
                  payable. Two of the three: there is NO freight row, because
                  that rule is unsettled and the line was already removed from
                  five places once (§3.1). The piece count rides in the
                  Subtotal label, exactly as the prototype does it, so dropping
                  the old Items / Quantities / Selling-units rows loses nothing
                  a customer needed. */}
              <dl className="space-y-1.5 text-body-sm">
                <Row
                  k={`Subtotal (${t.pieces.toLocaleString("en-IN")} pcs)`}
                  v={totalLabel}
                />
              </dl>

              <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="font-bold">Total payable</span>
                <span className="text-xl font-extrabold tabular-nums">
                  {totalLabel}
                </span>
              </div>

              {canViewPrices && belowMinOrder && (
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

              {canViewPrices && priceChanges.length > 0 && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-body-sm"
                >
                  <p className="font-bold">Prices updated — please review</p>
                  <ul className="mt-2 space-y-1">
                    {priceChanges.map(change => (
                      <li key={change.productId}>
                        {change.name}:{" "}
                        {change.before > 0
                          ? `₹${money(change.before)}`
                          : "On enquiry"}
                        {" → "}
                        {change.after > 0
                          ? `₹${money(change.after)}`
                          : "On enquiry"}{" "}
                        per selling unit
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    No order has been placed. Confirm below to use these prices.
                  </p>
                </div>
              )}
              <button
                onClick={handlePlaceOrder}
                disabled={
                  placing ||
                  isLoading ||
                  (canViewPrices && t.anyInvalidQuantity)
                }
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-body-md font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {placing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageCircle size={16} />
                )}
                {!canViewPrices
                  ? "Sign in to place order"
                  : priceChanges.length
                    ? "Confirm updated prices and send order"
                    : "Send order on WhatsApp"}
              </button>

              {!canViewPrices && (
                <button
                  onClick={handleGuestWhatsApp}
                  disabled={isLoading || t.anyInvalidQuantity}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 text-body-md font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageCircle size={16} />
                  Send cart on WhatsApp
                </button>
              )}

              <p className="mt-2 text-center text-caption text-slate-500">
                {canViewPrices
                  ? "Order is saved and confirmed on WhatsApp · GST invoice included"
                  : "Share quantities to ask for rates. Your cart stays saved."}
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
