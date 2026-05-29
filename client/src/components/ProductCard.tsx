import { Product } from '@/lib/supabase';
import { Link } from 'wouter';
import { MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';

interface ProductCardProps {
  product: Product;
  view?: 'grid' | 'list';
  onEnquire?: (product: Product) => void;
}

export default function ProductCard({ product, view = 'grid', onEnquire }: ProductCardProps) {
  const { isAuthenticated } = useAuthStore();
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';

  const handleEnquire = () => {
    const message = `Hi, I'm interested in: ${product.name}. Price: ₹${product.price}. Please provide more details.`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (view === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-slate-300 transition flex">
        {/* Image */}
        <div className="w-24 h-24 bg-slate-100 flex-shrink-0 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.image_alt_text || product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">
              📦
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link href={`/product/${product.id}`} className="block">
              <h3 className="font-semibold text-sm text-slate-900 hover:text-red-600 transition line-clamp-1">
                {product.name}
              </h3>
            </Link>
            <p className="text-xs text-slate-500 mt-1">
              {product.quantity_in_unit} {product.unit_of_measure}
            </p>
          </div>

          {/* Price & Action */}
          <div className="flex-shrink-0 text-right">
            {isAuthenticated ? (
              <p className="font-bold text-red-600 text-sm">₹{product.price.toLocaleString()}</p>
            ) : (
              <p className="text-xs text-slate-500 font-semibold">Login to see price</p>
            )}
            <button
              onClick={handleEnquire}
              className="mt-2 px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-red-600 hover:text-white hover:border-red-600 transition flex items-center gap-1 whitespace-nowrap"
            >
              <MessageCircle size={12} />
              Enquire
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <Link href={`/product/${product.id}`}>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-slate-300 transition cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="aspect-square bg-slate-100 overflow-hidden relative group">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.image_alt_text || product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">
              📦
            </div>
          )}
          {product.is_featured && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            {product.quantity_in_unit} {product.unit_of_measure}
          </p>
          <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 mb-2 flex-1">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mb-3">
            {isAuthenticated ? (
              <p className="font-bold text-red-600 text-lg">₹{product.price.toLocaleString()}</p>
            ) : (
              <p className="text-xs text-slate-500 font-semibold">Login to see price</p>
            )}
          </div>

          {/* Enquire Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              handleEnquire();
            }}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-red-600 hover:text-white hover:border-red-600 transition flex items-center justify-center gap-1"
          >
            <MessageCircle size={14} />
            Enquire on WhatsApp
          </button>
        </div>
      </div>
    </Link>
  );
}
