import { useState } from 'react';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { Product } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  product: Product;
  compact?: boolean;
}

export default function AddToCartButton({ product, compact = false }: Props) {
  const { items, addItem, updateQuantity } = useCartStore();
  const [qty, setQty] = useState(1);

  const existing = items.find((i) => i.productId === product.id);
  const inCart = !!existing;
  const moq = product.moq ?? 1;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      sku: product.sku ?? product.id,
      name: product.name,
      price: product.price ?? 0,
      priceOnEnquiry: product.price == null ? true : undefined,
      unit: product.unit_of_measure ?? 'pcs',
      imageUrl: product.image_url,
      moq,
    });
    if (qty > 1) {
      updateQuantity(product.id, qty);
    }
    if (qty < moq) {
      toast.warning(`Minimum order qty is ${moq} — added ${moq}`);
      updateQuantity(product.id, moq);
    } else {
      toast.success(`Added to cart`);
    }
  };

  const handleQtyChange = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setQty((q) => Math.max(1, q + delta));
  };

  if (compact) {
    return inCart ? (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="w-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 border border-green-200 rounded flex items-center justify-center gap-1"
      >
        <ShoppingCart size={12} />
        In Cart ({existing!.quantity})
      </button>
    ) : (
      <button
        onClick={handleAdd}
        className="w-full px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition flex items-center justify-center gap-1"
      >
        <ShoppingCart size={12} />
        Add to Cart
      </button>
    );
  }

  return (
    <div className="space-y-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      {!inCart ? (
        <div className="flex items-center gap-2">
          {/* Qty selector */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={(e) => handleQtyChange(e, -1)}
              className="px-3 py-2 hover:bg-slate-100 transition text-slate-600 font-bold"
              disabled={qty <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="px-3 py-2 text-sm font-semibold min-w-[2.5rem] text-center">{qty}</span>
            <button
              type="button"
              onClick={(e) => handleQtyChange(e, 1)}
              className="px-3 py-2 hover:bg-slate-100 transition text-slate-600 font-bold"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            Add to Cart
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-green-200 bg-green-50 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, existing!.quantity - 1); }}
              className="px-3 py-2 hover:bg-green-100 transition text-green-700 font-bold"
            >
              <Minus size={14} />
            </button>
            <span className="px-3 py-2 text-sm font-semibold min-w-[2.5rem] text-center text-green-800">{existing!.quantity}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, existing!.quantity + 1); }}
              className="px-3 py-2 hover:bg-green-100 transition text-green-700 font-bold"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-sm font-semibold text-green-700 flex items-center gap-1">
            <ShoppingCart size={16} />
            In Cart
          </span>
        </div>
      )}
      {qty < moq && !inCart && (
        <p className="text-xs text-amber-600">Min. order qty: {moq}</p>
      )}
    </div>
  );
}
