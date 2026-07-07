import { useState } from "react";
import { Link, useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Minus,
  Plus,
  ShoppingCart,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { orderService } from "@/lib/orderService";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { toast } from "sonner";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

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

  const total = getTotal();
  const count = getItemCount();
  const allEnquiry = items.length > 0 && items.every(i => i.priceOnEnquiry);
  const anyMoqWarn = items.some(i => i.quantity < i.moq);

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (anyMoqWarn) {
      toast.error("Some items are below MOQ — fix them to proceed");
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full">
          <h1 className="text-2xl font-extrabold tracking-tight mb-5">
            Your Cart{" "}
            {count > 0 && (
              <span className="text-sm font-semibold text-slate-500">
                · {items.length} items, {count} units
              </span>
            )}
          </h1>

          {items.length === 0 ? (
            /* Empty state */
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl px-6 py-14 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart size={26} className="text-slate-400" />
              </div>
              <div className="text-base font-bold mb-1.5">
                Your cart is empty
              </div>
              <div className="text-[13.5px] text-slate-500 mb-5">
                Browse the catalogue and add products — MOQ is pre-filled for
                you.
              </div>
              <Link
                href="/catalog"
                className="inline-flex bg-red-600 text-white px-5 py-3 rounded-xl text-[13.5px] font-bold hover:bg-red-700 transition"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
              {/* Lines */}
              <div className="flex flex-col gap-3">
                {items.map(item => {
                  const warn = item.quantity < item.moq;
                  return (
                    <div
                      key={item.productId}
                      className={`bg-white border rounded-2xl p-4 flex gap-3.5 items-center ${
                        warn ? "border-red-200" : "border-slate-200"
                      }`}
                    >
                      <Link
                        href={`/product/${item.productId}`}
                        className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      >
                        {item.imageUrl ? (
                          <img
                            src={normalizeImageUrl(item.imageUrl, 150) ?? ""}
                            alt={item.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <ShoppingCart size={20} className="text-slate-300" />
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/product/${item.productId}`}
                          className="text-sm font-bold hover:text-red-600 transition line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.priceOnEnquiry
                            ? "Price on enquiry"
                            : `₹${item.price.toLocaleString()} / ${item.unit}`}
                        </div>
                        {warn && (
                          <div className="inline-flex items-center gap-1.5 mt-1.5 bg-red-50 border border-red-200 text-red-700 text-[11.5px] font-bold px-2.5 py-1 rounded-lg">
                            Below MOQ — minimum {item.moq}.
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.moq)
                              }
                              className="underline font-extrabold"
                            >
                              Fix to {item.moq}
                            </button>
                          </div>
                        )}
                        <div className="mt-1.5">
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-xs font-semibold text-slate-500 hover:text-red-600 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center border-[1.5px] border-slate-300 rounded-xl overflow-hidden h-11 flex-shrink-0">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1)
                          }
                          className="w-10 h-full bg-slate-50 hover:bg-slate-100 transition flex items-center justify-center"
                          aria-label="Decrease"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          value={item.quantity}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) updateQuantity(item.productId, v);
                          }}
                          className="w-12 text-center text-sm font-bold tabular-nums outline-none"
                          inputMode="numeric"
                        />
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                          className="w-10 h-full bg-slate-50 hover:bg-slate-100 transition flex items-center justify-center"
                          aria-label="Increase"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <div className="w-24 text-right text-[15px] font-extrabold tabular-nums hidden sm:block">
                        {item.priceOnEnquiry
                          ? "—"
                          : `₹${(item.price * item.quantity).toLocaleString()}`}
                      </div>
                    </div>
                  );
                })}

                {/* Order notes */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[13px] font-bold mb-2">
                    Order notes{" "}
                    <span className="font-medium text-slate-400">
                      (optional)
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Need extra-strong boxes; deliver after 4pm"
                    className="w-full min-h-16 border border-slate-300 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-red-600 resize-y"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:sticky lg:top-24">
                <div className="text-[15px] font-extrabold mb-3.5">
                  Order Summary
                </div>
                <div className="flex justify-between text-[13.5px] text-slate-600 py-1.5">
                  <span>Subtotal ({count} units)</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {allEnquiry ? "On enquiry" : `₹${total.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between text-[13.5px] text-slate-600 py-1.5">
                  <span>Delivery</span>
                  <span className="font-bold text-emerald-700">
                    FREE (Surat)
                  </span>
                </div>
                <div className="border-t border-slate-200 mt-2.5 pt-2.5 flex justify-between text-base font-extrabold mb-3">
                  <span>Total</span>
                  <span className="text-red-600 tabular-nums">
                    {allEnquiry ? "On enquiry" : `₹${total.toLocaleString()}`}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-400 -mt-1 mb-3">
                  GST &amp; final pricing confirmed on WhatsApp.
                </p>

                {anyMoqWarn && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-lg mb-3">
                    Some items are below MOQ — fix them to proceed.
                  </div>
                )}

                {/* Customer details */}
                <div className="space-y-2 mb-3.5">
                  <input
                    placeholder="Your name *"
                    value={customer.name}
                    onChange={e =>
                      setCustomer({ ...customer, name: e.target.value })
                    }
                    className="w-full h-11 border border-slate-300 rounded-xl px-3.5 text-[13.5px] outline-none focus:border-red-600"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (WhatsApp) *"
                    value={customer.phone}
                    onChange={e =>
                      setCustomer({ ...customer, phone: e.target.value })
                    }
                    className="w-full h-11 border border-slate-300 rounded-xl px-3.5 text-[13.5px] outline-none focus:border-red-600"
                  />
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || anyMoqWarn}
                  className={`w-full h-[50px] rounded-xl text-[15px] font-bold text-white transition flex items-center justify-center gap-2 ${
                    anyMoqWarn
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_18px_rgba(5,150,105,0.25)]"
                  }`}
                >
                  {placing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Placing Order…
                    </>
                  ) : (
                    <>
                      <MessageCircle size={18} />
                      Place Order via WhatsApp
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-400 text-center mt-2.5">
                  Order is saved + confirmed on WhatsApp · GST invoice included
                </p>
                <button
                  onClick={() => {
                    if (confirm("Clear cart?")) clearCart();
                  }}
                  className="w-full text-xs text-slate-400 hover:text-red-500 transition mt-2"
                >
                  Clear cart
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
