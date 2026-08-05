import { useState } from "react";
import { Link, useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MessageCircle, Loader2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { orderService } from "@/lib/orderService";
import { useMinOrder } from "@/hooks/useMinOrder";
import { formatRupees } from "@/lib/priceUtils";
import { toast } from "sonner";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

/**
 * The order review screen (docs/DESIGN_SYSTEM.md §3.9).
 *
 * Same rate-card vocabulary: line items separated by hairlines rather than
 * boxed in cards, every figure in mono with tabular numerals, the total on the
 * 2px ink rule. On-enquiry lines never contribute a rupee figure and never
 * render ₹0 — they carry an amber marker and are quoted on WhatsApp.
 */
export default function Cart() {
  const [, setLocation] = useLocation();
  const {
    items,
    customer,
    updateQuantity,
    removeItem,
    setCustomer,
    clearCart,
    getTotal,
    getItemCount,
  } = useCartStore();
  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState("");
  const minOrder = useMinOrder();

  const total = getTotal();
  const count = getItemCount();
  const allEnquiry = items.length > 0 && items.every(i => i.priceOnEnquiry);
  const anyMoqWarn = items.some(i => i.quantity < i.moq);
  const belowMinOrder =
    minOrder.enabled && !allEnquiry && total < minOrder.value;
  const minOrderRemaining = belowMinOrder ? minOrder.value - total : 0;
  // Block checkout until the real setting has loaded — otherwise a genuine
  // ON setting can be bypassed by submitting before the fetch resolves.
  const checkoutBlocked = minOrder.loading || belowMinOrder;

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error("Your order is empty");
      return;
    }
    if (anyMoqWarn) {
      toast.error("Some items are below MOQ — fix them to proceed");
      return;
    }
    if (minOrder.loading) {
      toast.error("Checking order settings — try again in a moment");
      return;
    }
    if (belowMinOrder) {
      toast.error(
        `Add ${formatRupees(minOrderRemaining)} more to meet the minimum order value`
      );
      return;
    }
    if (!customer.name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/\s+/g, ""))) {
      toast.error("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setPlacing(true);
    try {
      await orderService.placeOrder(items, customer);
      let message = orderService.buildWhatsAppMessage(items, customer);
      if (notes.trim()) message += `\nNotes: ${notes.trim()}`;
      window.open(
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`,
        "_blank"
      );
      clearCart();
      setNotes("");
      toast.success("Order placed! Opening WhatsApp…");
      setLocation("/");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const fieldClass =
    "w-full h-11 px-3.5 border border-rule bg-white text-body-sm text-ink outline-none focus:border-ink transition-colors duration-150 placeholder:text-ink-faint";

  return (
    <div className="min-h-screen bg-white flex flex-col text-ink">
      <Header />

      <main className="flex-1 pb-28 md:pb-12">
        <div className="shell pt-6 md:pt-8">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-4">
            <h1 className="font-display text-display md:text-display-lg font-bold tracking-[-0.03em]">
              Your order
            </h1>
            {count > 0 && (
              <span className="font-mono text-micro md:text-body-sm font-medium text-ink-faint whitespace-nowrap tabular-nums">
                {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                {count.toLocaleString("en-IN")} packs
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-body-md font-semibold">Your order is empty</p>
              <p className="text-body-sm text-ink-muted mt-1.5 mb-5">
                Browse the catalogue and add packs — MOQ is pre-filled for you.
              </p>
              <Link
                href="/catalog"
                className="inline-flex bg-ink text-white px-5 py-3 text-body-sm font-semibold hover:bg-red-600 transition-colors duration-150"
              >
                Browse the rate card
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_360px] lg:gap-x-[56px] items-start">
              {/* ── Lines ── */}
              <div>
                {items.map(item => {
                  const warn = item.quantity < item.moq;
                  return (
                    <div
                      key={item.productId}
                      className="border-b border-rule py-4 flex gap-4 items-start"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/product/${item.productId}`}
                          className="text-body-sm md:text-body-md font-medium text-ink hover:text-red-600 transition-colors duration-150"
                        >
                          {item.name}
                        </Link>

                        <div className="mt-2 border-t-2 border-ink flex">
                          <span
                            className={`font-mono text-caption font-semibold px-2 py-[5px] text-white whitespace-nowrap tabular-nums ${
                              item.priceOnEnquiry ? "bg-amber-600" : "bg-ink"
                            }`}
                          >
                            {item.priceOnEnquiry
                              ? "On enquiry"
                              : `${formatRupees(item.price)}/pack`}
                          </span>
                        </div>

                        {warn && (
                          <p className="font-mono text-caption font-medium text-red-600 mt-2.5">
                            Below MOQ — minimum {item.moq}.{" "}
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.moq)
                              }
                              className="underline font-semibold"
                            >
                              Fix to {item.moq}
                            </button>
                          </p>
                        )}

                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-micro font-medium text-ink-faint hover:text-red-600 transition-colors duration-150 mt-2.5"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="flex-none flex flex-col items-end gap-2.5">
                        <div className="flex items-stretch h-10 border-2 border-ink">
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="w-9 flex items-center justify-center font-mono text-body-sm font-semibold hover:bg-sunken transition-colors duration-150"
                          >
                            −
                          </button>
                          <input
                            value={item.quantity}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) updateQuantity(item.productId, v);
                            }}
                            aria-label={`Quantity of ${item.name} in packs`}
                            inputMode="numeric"
                            className="w-11 text-center font-mono text-body-sm font-bold outline-none tabular-nums"
                          />
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-9 flex items-center justify-center font-mono text-body-sm font-semibold hover:bg-sunken transition-colors duration-150"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-mono text-body-sm md:text-body-md font-bold text-ink tabular-nums">
                          {item.priceOnEnquiry
                            ? "—"
                            : formatRupees(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="mt-6">
                  <label
                    htmlFor="order-notes"
                    className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint"
                  >
                    Order notes (optional)
                  </label>
                  <textarea
                    id="order-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Need extra-strong boxes; deliver after 4pm"
                    className="w-full min-h-20 mt-2.5 border border-rule px-3.5 py-2.5 text-body-sm outline-none focus:border-ink transition-colors duration-150 resize-y placeholder:text-ink-faint"
                  />
                </div>
              </div>

              {/* ── Summary ── */}
              <div className="mt-8 lg:mt-0 lg:sticky lg:top-6 self-start">
                <div className="border-t-2 border-ink pt-4">
                  <div className="flex justify-between text-body-sm text-ink-muted py-1.5">
                    <span>
                      Subtotal ({count.toLocaleString("en-IN")} packs)
                    </span>
                    <span className="font-mono font-semibold text-ink tabular-nums">
                      {allEnquiry ? "On enquiry" : formatRupees(total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-body-sm text-ink-muted py-1.5">
                    <span>Delivery</span>
                    <span className="font-semibold text-wa">Free in Surat</span>
                  </div>
                  <div className="border-t border-rule mt-2.5 pt-3 flex justify-between items-baseline">
                    <span className="text-body-md font-semibold">Total</span>
                    <span className="font-mono text-price font-bold text-ink tracking-[-0.025em] tabular-nums">
                      {allEnquiry ? "On enquiry" : formatRupees(total)}
                    </span>
                  </div>
                  <p className="text-caption text-ink-faint mt-2">
                    GST &amp; final pricing confirmed on WhatsApp.
                  </p>
                </div>

                {anyMoqWarn && (
                  <p className="font-mono text-caption font-medium text-red-600 mt-4">
                    Some items are below MOQ — fix them to proceed.
                  </p>
                )}
                {belowMinOrder && (
                  <p className="font-mono text-caption font-medium text-red-600 mt-4 tabular-nums">
                    Add {formatRupees(minOrderRemaining)} more to meet the
                    minimum order value of {formatRupees(minOrder.value)}.
                  </p>
                )}

                <div className="flex flex-col gap-2.5 mt-5">
                  <input
                    placeholder="Your name"
                    aria-label="Your name"
                    value={customer.name}
                    onChange={e =>
                      setCustomer({ ...customer, name: e.target.value })
                    }
                    className={fieldClass}
                  />
                  <input
                    type="tel"
                    placeholder="Phone (WhatsApp)"
                    aria-label="Phone number for WhatsApp"
                    value={customer.phone}
                    onChange={e =>
                      setCustomer({ ...customer, phone: e.target.value })
                    }
                    className={fieldClass}
                  />
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || anyMoqWarn || checkoutBlocked}
                  className={`w-full h-[50px] mt-3 text-body-md font-semibold text-white flex items-center justify-center gap-2 transition-colors duration-150 ${
                    anyMoqWarn || checkoutBlocked
                      ? "bg-ink-faint cursor-not-allowed"
                      : "bg-wa hover:bg-emerald-700"
                  }`}
                >
                  {placing ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Placing order…
                    </>
                  ) : (
                    <>
                      <MessageCircle size={17} />
                      Place order via WhatsApp
                    </>
                  )}
                </button>
                <p className="text-caption text-ink-faint text-center mt-2.5">
                  Order is saved + confirmed on WhatsApp · GST invoice included
                </p>
                <button
                  onClick={() => {
                    if (confirm("Clear this order?")) clearCart();
                  }}
                  className="w-full text-caption text-ink-faint hover:text-red-600 transition-colors duration-150 mt-2.5"
                >
                  Clear order
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
