import { Product } from '@/lib/supabase';
import { Link } from 'wouter';
import { MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import { enquiryService } from '@/lib/productService';
import { ImagePlaceholder } from './ImagePlaceholder';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  view?: 'grid' | 'list';
  onEnquire?: (product: Product) => void;
}

/**
 * SmartImage — product image with a loading shimmer and fade-in.
 * Falls back to the branded placeholder on error or when no URL is set.
 * Used by both grid and list views so behaviour stays consistent.
 */
function SmartImage({
  src,
  alt,
  className,
  placeholderClassName,
}: {
  src?: string;
  alt: string;
  className: string;
  placeholderClassName: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return <ImagePlaceholder className={placeholderClassName} showText={false} />;
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
}

export default function ProductCard({ product, view = 'grid', onEnquire }: ProductCardProps) {
  const { isAuthenticated, user, profile } = useAuthStore();
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';

  const handleEnquire = async () => {
    if (onEnquire) {
      onEnquire(product);
      return;
    }
    if (isAuthenticated && user) {
      try {
        await enquiryService.create({
          user_id: user.id,
          product_id: product.id,
          customer_name: profile?.contact_person || profile?.company_name || user.email || 'Customer',
          customer_email: profile?.email || user.email || '',
          customer_phone: profile?.phone || '',
          customer_company: profile?.company_name,
          quantity_requested: 1,
          enquiry_source: 'whatsapp',
          status: 'new',
        });
      } catch (err) {
        console.error('Failed to save enquiry:', err);
      }
    }
    const message = isAuthenticated
      ? `Hi, I'm interested in: ${product.name}. Price: ₹${product.price}. Please provide more details.`
      : `Hi, I'm interested in: ${product.name}. Could you please share the price and more details?`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (view === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-slate-300 transition flex">
        {/* Image */}
        <Link href={`/product/${product.id}`} className="w-24 h-24 flex-shrink-0 relative overflow-hidden bg-white">
          <SmartImage
            src={product.image_url}
            alt={product.image_alt_text || product.name}
            className="w-full h-full object-contain p-1.5"
            placeholderClassName="w-24 h-24"
          />
        </Link>

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
              <p className="font-bold text-red-600 text-sm">₹{product.price?.toLocaleString()}</p>
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
        <div className="aspect-square overflow-hidden relative group flex-shrink-0 bg-white">
          <SmartImage
            src={product.image_url}
            alt={product.image_alt_text || product.name}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            placeholderClassName="w-full h-full"
          />
          {product.is_featured && (
            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-2 flex-1 flex flex-col">
          {product.quantity_in_unit ? (
            <p className="text-[10px] text-slate-500 font-medium mb-0.5">
              Pack of {product.quantity_in_unit} {product.unit_of_measure}
            </p>
          ) : null}
          <h3 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-tight flex-1 mb-1.5">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mb-1.5">
            {isAuthenticated ? (
              <p className="font-bold text-red-600 text-sm leading-none">₹{product.price?.toLocaleString()}</p>
            ) : (
              <p className="text-[10px] text-slate-500 font-semibold">Sign in for price</p>
            )}
          </div>

          {/* Enquire Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              handleEnquire();
            }}
            className="w-full px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-red-600 hover:text-white hover:border-red-600 transition flex items-center justify-center gap-1"
          >
            <MessageCircle size={12} />
            Enquire
          </button>
        </div>
      </div>
    </Link>
  );
}
