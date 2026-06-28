import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, MessageCircle, Share2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  productService,
  productImageService,
  enquiryService,
  inquiriesService,
} from "@/lib/productService";
import { masterService } from "@/lib/masterService";
import { Product, ProductImage } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { ImagePlaceholder } from "@/components/ImagePlaceholder";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { normalizeImageUrl } from "@/lib/imageUtils";

// ─── Recently Viewed helpers ───────────────────────────────────────────────
const RECENTLY_VIEWED_KEY = "xl_recently_viewed";
const MAX_RECENT = 6;

function saveToRecentlyViewed(id: string) {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    const updated = [id, ...ids.filter(i => i !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    /* storage unavailable */
  }
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
function MiniProductCard({
  product,
  isAuthenticated,
}: {
  product: Product;
  isAuthenticated: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/product/${product.id}`}>
      <div className="group flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md hover:border-red-200 transition w-36 sm:w-auto flex-shrink-0">
        <div className="h-28 overflow-hidden bg-slate-100">
          {product.image_url && !imgError ? (
            <img
              src={normalizeImageUrl(product.image_url)}
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
            <p className="text-sm font-bold mb-1.5">
              {product.price != null ? (
                <span className="text-red-600">
                  ₹{product.price.toLocaleString()}
                </span>
              ) : (
                <span className="text-slate-500 italic text-xs">
                  Price on enquiry
                </span>
              )}
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
function ProductRow({
  title,
  products,
  isAuthenticated,
}: {
  title: string;
  products: Product[];
  isAuthenticated: boolean;
}) {
  if (!products.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-slate-900 mb-4">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide sm:hidden">
        {products.map(p => (
          <div key={p.id} className="snap-start">
            <MiniProductCard product={p} isAuthenticated={isAuthenticated} />
          </div>
        ))}
      </div>
      <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(p => (
          <MiniProductCard
            key={p.id}
            product={p}
            isAuthenticated={isAuthenticated}
          />
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
  const { isAuthenticated, user, profile } = useAuthStore();

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";

  const [variants, setVariants] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        const prod = await productService.getById(id);
        setProduct(prod);
        setSelectedVariant(prod);

        if (prod?.master_id) {
          const mImgs = await masterService.getMasterImages(prod.master_id);
          setImages(
            mImgs.map(img => ({
              id: img.id,
              product_id: prod.id,
              image_url: img.image_url,
              display_order: img.display_order,
              created_at: img.created_at,
            }))
          );

          const vData = await masterService.getVariantsByMasterId(
            prod.master_id
          );
          setVariants(vData);
        } else {
          const imgs = await productImageService.getByProductId(id);
          setImages(imgs);
          setVariants([]);
        }

        saveToRecentlyViewed(id);
        if (prod?.category_id) {
          const all = await productService.getAll({
            categoryId: prod.category_id,
          });
          setSimilarProducts(all.filter(p => p.id !== id).slice(0, 4));
        }
      } catch (error) {
        console.error("Error loading product:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadRecent = async () => {
      const ids = getRecentlyViewedIds().filter(rid => rid !== id);
      if (!ids.length) return;
      try {
        const results = await Promise.all(
          ids.map(rid => productService.getById(rid))
        );
        setRecentlyViewed(results.filter((p): p is Product => p !== null));
      } catch {
        /* silently skip */
      }
    };
    loadRecent();
  }, [id]);

  const currentProd = selectedVariant || product;

  const handleEnquire = () => {
    if (!currentProd) return;
    const priceStr =
      currentProd.price != null
        ? `\nPrice: ₹${currentProd.price}`
        : "\nPrice: On enquiry";
    // Omit the quantity line entirely when pack size is missing — never print "null".
    const quantityStr =
      currentProd.quantity_in_unit != null
        ? `\nQuantity: ${currentProd.quantity_in_unit} ${currentProd.unit_of_measure}`
        : "";
    const message = isAuthenticated
      ? `Hi, I'm interested in: ${currentProd.name}${priceStr}${quantityStr}\n\nPlease provide more details and availability.`
      : `Hi, I'm interested in: ${currentProd.name}${quantityStr}\n\nCould you please share the price and availability?`;

    // Open WhatsApp immediately (must stay in synchronous click-handler
    // context so browsers don't treat it as a popup).
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    // Fire-and-forget DB logging — never blocks WhatsApp opening.
    inquiriesService
      .create({
        customer_name:
          isAuthenticated && profile
            ? profile.contact_person ||
              profile.company_name ||
              user?.email ||
              ""
            : "",
        phone: isAuthenticated && profile?.phone ? profile.phone : "",
        message,
        product_name: currentProd.name ?? "",
        source: "website",
      })
      .catch(() => {});

    if (isAuthenticated && user && currentProd) {
      enquiryService
        .create({
          user_id: user.id,
          product_id: currentProd.id,
          customer_name:
            profile?.contact_person ||
            profile?.company_name ||
            user.email ||
            "Customer",
          customer_email: profile?.email || user.email || "",
          customer_phone: profile?.phone || "",
          customer_company: profile?.company_name,
          quantity_requested: 1,
          enquiry_source: "whatsapp",
          status: "new",
        })
        .catch(() => {});
    }
  };

  const handleShare = () => {
    if (navigator.share && currentProd) {
      navigator.share({
        title: currentProd.name,
        text: `Check out this product: ${currentProd.name}`,
        url: window.location.href,
      });
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
            <button
              onClick={() => setLocation("/catalog")}
              className="text-red-600 font-semibold hover:text-red-700"
            >
              Back to Catalog
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const displayImages = images.length > 0 ? images : [];
  const mainImage = normalizeImageUrl(
    displayImages.length > 0
      ? displayImages[selectedImageIndex]?.image_url
      : currentProd?.image_url || ""
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back */}
          <button
            onClick={() => setLocation("/catalog")}
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
                    src={mainImage}
                    alt={currentProd?.image_alt_text || currentProd?.name}
                    className="w-full h-full object-contain p-4"
                    onError={() =>
                      handleImageError(`main-${selectedImageIndex}`)
                    }
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
                        selectedImageIndex === idx
                          ? "border-red-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {!imageErrors.has(img.id) ? (
                        <img
                          src={normalizeImageUrl(img.image_url)}
                          alt={img.alt_text || `Product image ${idx + 1}`}
                          className="w-full h-full object-contain p-1 bg-white"
                          onError={() => handleImageError(img.id)}
                        />
                      ) : (
                        <ImagePlaceholder
                          className="w-20 h-20"
                          showText={false}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div>
              <div className="bg-white border border-slate-200 rounded-lg p-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                  {currentProd.name}
                </h1>
                <div className="flex items-center gap-3 flex-wrap mb-6">
                  <p className="text-slate-400 text-sm">
                    SKU: {currentProd.sku || "N/A"}
                  </p>
                  {currentProd.barcode && (
                    <p className="text-slate-400 text-sm">
                      Barcode: {currentProd.barcode}
                    </p>
                  )}
                  {currentProd.moq && currentProd.moq > 1 && (
                    <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      Min. order: {currentProd.moq}
                    </span>
                  )}
                </div>

                {/* Variant Selector */}
                {variants.length > 1 && (
                  <div className="mb-6 pb-6 border-b border-slate-200">
                    <p className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-2.5">
                      Available Sizes / Options:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variants.map(v => {
                        const isSelected = currentProd.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setSelectedVariant(v);
                              window.history.replaceState(
                                null,
                                "",
                                `/product/${v.id}`
                              );
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                              isSelected
                                ? "bg-red-600 text-white border border-red-600"
                                : "border border-slate-200 text-slate-700 hover:border-red-400 bg-white hover:bg-red-50/10"
                            }`}
                          >
                            {v.variant_label || v.name}
                            {isSelected && (
                              <span className="ml-1 text-[10px]">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-slate-200">
                  {isAuthenticated ? (
                    <div>
                      <p className="text-slate-600 text-sm font-semibold mb-2">
                        Price
                      </p>
                      {currentProd.price != null ? (
                        <p className="text-4xl font-bold text-red-600">
                          ₹{currentProd.price.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-xl font-semibold text-slate-500 italic">
                          Price on enquiry
                        </p>
                      )}
                      <p className="text-slate-500 text-sm mt-2">
                        Per {currentProd.quantity_in_unit}{" "}
                        {currentProd.unit_of_measure}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-center">
                      <p className="text-slate-600 font-semibold mb-2">
                        Sign in to view pricing
                      </p>
                      <button
                        onClick={() => setLocation("/auth")}
                        className="text-red-600 font-semibold hover:text-red-700"
                      >
                        Sign In Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Specifications */}
                {currentProd.specifications &&
                  Object.keys(currentProd.specifications).length > 0 && (
                    <div className="mb-8 pb-8 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 mb-4">
                        Specifications
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(currentProd.specifications).map(
                          ([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate-600 capitalize">
                                {key}:
                              </span>
                              <span className="font-semibold text-slate-900">
                                {String(value)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Description */}
                {currentProd.description && (
                  <div className="mb-8 pb-8 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3">
                      Description
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {currentProd.description}
                    </p>
                  </div>
                )}

                {/* Features */}
                <div className="mb-8 pb-8 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">
                    Key Features
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>Premium
                      quality materials
                    </li>
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>Bulk
                      order discounts available
                    </li>
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>Fast
                      delivery in Surat
                    </li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {/* Add to Cart (authenticated users — null-price items enter as enquiry lines) */}
                  {isAuthenticated && <AddToCartButton product={currentProd} />}

                  <button
                    onClick={handleEnquire}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={20} />
                    Enquire on WhatsApp
                  </button>
                  <div className="flex gap-3">
                    <a
                      href={`tel:${phone1}`}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition text-center"
                    >
                      📞 Call
                    </a>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Share2 size={18} />
                      Share
                    </button>
                  </div>
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-1">💡 Need bulk quantities?</p>
                  <p>
                    Contact us for special pricing on bulk orders and
                    customization options.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Similar Products */}
          <ProductRow
            title="Similar Products"
            products={similarProducts}
            isAuthenticated={isAuthenticated}
          />

          {/* Recently Viewed */}
          <ProductRow
            title="Recently Viewed"
            products={recentlyViewed}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
