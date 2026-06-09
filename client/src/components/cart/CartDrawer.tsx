import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus, Trash2, ShoppingCart, MessageCircle, Loader2, PackageOpen } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { orderService } from '@/lib/orderService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';

export default function CartDrawer({ open, onClose }: Props) {
  const { items, customer, updateQuantity, removeItem, setCustomer, clearCart, getTotal, getItemCount } = useCartStore();
  const [placing, setPlacing] = useState(false);

  const total = getTotal();
  const count = getItemCount();

  const handlePlaceOrder = async () => {
    if (items.length === 0) { toast.error('Your cart is empty'); return; }
    if (!customer.name.trim()) { toast.error('Please enter your name'); return; }
    if (!customer.phone.trim()) { toast.error('Please enter your phone number'); return; }
    if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/\s+/g, ''))) {
      toast.error('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setPlacing(true);
    try {
      await orderService.placeOrder(items, customer);
      const message = orderService.buildWhatsAppMessage(items, customer);
      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
      clearCart();
      onClose();
      toast.success('Order placed! Opening WhatsApp…');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 border-b border-slate-200">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            Cart
            {count > 0 && (
              <span className="ml-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <PackageOpen className="w-14 h-14 mb-4 text-slate-300" />
              <p className="font-semibold text-slate-600 text-base">Your cart is empty</p>
              <p className="text-sm mt-1">Browse products and add them to cart</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="flex gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                {/* Thumbnail */}
                <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-50 border border-slate-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">{item.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.sku} · {item.unit}</p>
                  <p className="text-sm font-bold text-red-600 mt-1">
                    ₹{(item.price * item.quantity).toLocaleString()}
                    <span className="text-xs text-slate-400 font-normal ml-1">(₹{item.price.toLocaleString()} × {item.quantity})</span>
                  </p>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1 text-slate-300 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="px-2 py-1 hover:bg-slate-100 transition text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 text-sm font-semibold min-w-[1.75rem] text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="px-2 py-1 hover:bg-slate-100 transition text-slate-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {item.quantity < item.moq && (
                    <p className="text-[10px] text-amber-500">Min: {item.moq}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-4 space-y-4 bg-slate-50">
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Total ({count} items)</span>
              <span className="text-2xl font-bold text-red-600">₹{total.toLocaleString()}</span>
            </div>

            {/* Customer info */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your details</p>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="cart-name" className="text-xs">Name *</Label>
                  <Input
                    id="cart-name"
                    placeholder="Your full name"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    className="h-9 mt-0.5"
                  />
                </div>
                <div>
                  <Label htmlFor="cart-phone" className="text-xs">Phone (WhatsApp) *</Label>
                  <Input
                    id="cart-phone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    className="h-9 mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Place Order */}
            <Button
              onClick={handlePlaceOrder}
              disabled={placing || items.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 gap-2 h-12 text-base font-bold"
            >
              {placing ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Placing Order…</>
              ) : (
                <><MessageCircle className="w-5 h-5" />Place Order via WhatsApp</>
              )}
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Order is saved + sent to WhatsApp. No payment needed now.
            </p>

            <button
              onClick={() => { if (confirm('Clear cart?')) clearCart(); }}
              className="w-full text-xs text-slate-400 hover:text-red-500 transition"
            >
              Clear cart
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
