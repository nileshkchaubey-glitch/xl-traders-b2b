import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { ArrowLeft, MessageCircle, Share2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { productService, productImageService } from '@/lib/productService';
import { Product, ProductImage } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { normalizeImageUrl } from '@/lib/imageUtils';

// ─── Recently Viewed helpers ───────────────────────────────────────────────
const RECENTLY_VIEWED_KEY = 'xl_recently_viewed';
const MAX_RECENT = 6;

function saveToRecentlyViewed(id: string) {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    const updated = [id, ...ids.filter(i => i !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch { /* storage unavailable */ }
}

function getRecentlyViewedIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// ─── Mini product card (similar / recently viewed) ─────────────────────────
function MiniProductCard({ product, isAuthenticated }: { product: Product; isAuthenticated: boolean }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/product/${product.id}`}>
      <div className="group flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md hover:border-red-200 transition w-36 sm:w-auto flex-shrink-0">
        <div className="h-28 overflow-hidden bg-slate-100">
          {product.image_url && !imgError ? (
            <img
              src={normalizeImageUrl(product.image_url, 300)}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImagePlaceholder className="w-full h-full" showText={false} />
          )}
        </div>
        <div className="p-2 flex flex-col flex-1">
          <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-tight flex-1 mb-2">
            {product.name}
          </p>
          {isAuthenticated && (
            <p className="text-sm font-bold text-red-600 mb-1.5">
              ₹{product.price.toLocaleString()}
            </p>
          )}
          <span className="block w-full text-center text-xs font-semibold py-1 bg-slate-100 text-slate-700 rounded group-hover:bg-red-600 group-hover:text-white transition">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Horizontal scroll product row ─────────────────────────────────────────
function ProductRow({ title, products, isAuthenticated }: { title: string; products: Product[]; isAuthenticated: boolean }) {
  if (!products.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-slate-900 mb-4">{title}</h2>
      {/* Mobile: horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide sm:hidden">
        {products.map(p => (
          <div key={p.id} className="snap-start">
            <MiniProductCard product={p} isAuthenticated={isAuthenticated} />
          </div>
        ))}
      </div>
      {/* Desktop: grid */}
      <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(p => (
          <MiniProductCard key={p.id} product={p} isAuthenticated={isAuthenticated} />
        ))}
      </div>
    </section>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const { isAuthenticated } = useAuthStore();

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';
  const phone1 = import.meta.env.VITE_PHONE_1 || '9773239442';

  // Load product + similar products + save to recently viewed
  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        const prod = await productService.getById(id);
        setProduct(prod);
        const imgs = await productImageService.getByProductId(id);
        setImages(imgs);

        // Persist to recently viewed before fetching related data
        saveToRecentlyViewed(id);

        // Fetch similar products from same category
        if (prod?.category_id) {
          const all = await productService.getAll({ categoryId: prod.category_id });
          setSimilarProducts(all.filter(p => p.id !== id).slice(0, 4));
        }
      } catch (error) {
        console.error('Error loading product:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  // Load recently viewed products (excluding current)
  useEffect(() => {
    if (!id) return;
    const loadRecent = async () => {
      const ids = getRecentlyViewedIds().filter(rid => rid !== id);
      if (!ids.length) return;
      try {
        const results = await Promise.all(ids.map(rid => productService.getById(rid)));
        setRecentlyViewed(results.filter((p): p is Product => p !== null));
      } catch { /* silently skip */ }
    };
    loadRecent();
  }, [id]);

  const handleEnquire = () => {
    const message = `Hi, I'm interested in: ${product?.name}\n\nPrice: ₹${product?.price}\nQuantity: ${product?.quantity_in_unit} ${product?.unit_of_measure}\n\nPlease provide more details and availability.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product?.name, text: `Check out this product: ${product?.name}`, url: window.location.href });
    }
  };

  const handleImageError = (imageId: string) => {
    setImageErrors(prev => new Set(prev).add(imageId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Loading product...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-500 text-lg mb-4">Product not found</p>
            <button onClick={() => setLocation('/catalog')} className="text-red-600 font-semibold hover:text-red-700">
              Back to Catalog
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const displayImages = images.length > 0 ? images : [];
  const mainImage = displayImages.length > 0 ? displayImages[selectedImageIndex]?.image_url : product.image_url;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back */}
          <button
            onClick={() => setLocation('/catalog')}
            className="flex items-center gap-2 text-red-600 font-semibold hover:text-red-700 mb-8 transition"
          >
            <ArrowLeft size={18} />
            Back to Catalog
          </button>

          {/* Product grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Images */}
            <div>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 aspect-square flex items-center justify-center">
                {mainImage && !imageErrors.has(`main-${selectedImageIndex}`) ? (
                  <img
                    src={normalizeImageUrl(mainImage, 800)}
                    alt={product.image_alt_text || product.name}
                    className="w-full h-full object-contain p-4"
                    loading="lazy"
                    decoding="async"
                    onError={() => handleImageError(`main-${selectedImageIndex}`)}
                  />
                ) : (
                  <ImagePlaceholder className="w-full h-full" showText={true} />
                )}
              </div>
              {displayImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto">
                  {displayImages.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition ${
                        selectedImageIndex === idx ? 'border-red-600' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {!imageErrors.has(img.id) ? (
                        <img src={normalizeImageUrl(img.image_url, 160)} alt={img.alt_text || `Product image ${idx + 1}`} className="w-full h-full object-contain p-1 bg-white" loading="lazy" onError={() => handleImageError(img.id)} />
                      ) : (
                        <ImagePlaceholder className="w-20 h-20" showText={false} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div>
              <div className="bg-white border border-slate-200 rounded-lg p-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{product.name}</h1>
                <p className="text-slate-500 text-sm mb-6">SKU: {product.sku || 'N/A'}</p>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-slate-200">
                  {isAuthenticated ? (
                    <div>
                      <p className="text-slate-600 text-sm font-semibold mb-2">Price</p>
                      <p className="text-4xl font-bold text-red-600">₹{product.price.toLocaleString()}</p>
                      <p className="text-slate-500 text-sm mt-2">Per {product.quantity_in_unit} {product.unit_of_measure}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-center">
                      <p className="text-slate-600 font-semibold mb-2">Sign in to view pricing</p>
                      <button onClick={() => setLocation('/auth')} className="text-red-600 font-semibold hover:text-red-700">
                        Sign In Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Specifications */}
                {product.specifications && Object.keys(product.specifications).length > 0 && (
                  <div className="mb-8 pb-8 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-4">Specifications</h3>
                    <div className="space-y-3">
                      {Object.entries(product.specifications).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-600 capitalize">{key}:</span>
                          <span className="font-semibold text-slate-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {product.description && (
                  <div className="mb-8 pb-8 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3">Description</h3>
                    <p className="text-slate-600 leading-relaxed">{product.description}</p>
                  </div>
                )}

                {/* Features */}
                <div className="mb-8 pb-8 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Key Features</h3>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-slate-600"><span className="text-red-600 font-bold">✓</span>Premium quality materials</li>
                    <li className="flex gap-2 text-slate-600"><span className="text-red-600 font-bold">✓</span>Bulk order discounts available</li>
                    <li className="flex gap-2 text-slate-600"><span className="text-red-600 font-bold">✓</span>Fast delivery in Surat</li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={handleEnquire}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={20} />
                    Enquire on WhatsApp
                  </button>
                  <div className="flex gap-3">
                    <a href={`tel:${phone1}`} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition text-center">
                      📞 Call
                    </a>
                    <button onClick={handleShare} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
                      <Share2 size={18} />
                      Share
                    </button>
                  </div>
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-1">💡 Need bulk quantities?</p>
                  <p>Contact us for special pricing on bulk orders and customization options.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Similar Products */}
          <ProductRow title="Similar Products" products={similarProducts} isAuthenticated={isAuthenticated} />

          {/* Recently Viewed */}
          <ProductRow title="Recently Viewed" products={recentlyViewed} isAuthenticated={isAuthenticated} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
