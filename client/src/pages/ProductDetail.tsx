import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  MessageCircle,
  Share2,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
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
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry, cartLinePrice } from "@/lib/priceUtils";

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
              {!isPriceOnEnquiry(product.price) ? (
                <span className="text-red-600">
                  ₹{product.price!.toLocaleString()}
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

  // Buy panel state (prototype): quantity stepper + delivery pincode check
  const [qty, setQty] = useState(1);
  const [pincode, setPincode] = useState("");
  const [pinResult, setPinResult] = useState<string | null>(null);
  const { addItem, updateQuantity, items: cartItems } = useCartStore();

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

  // Start the stepper at the product's MOQ whenever the shown product changes.
  useEffect(() => {
    setQty(currentProd?.moq ?? 1);
  }, [currentProd?.id, currentProd?.moq]);

  const handleAddToCart = () => {
    if (!currentProd) return;
    const moq = currentProd.moq ?? 1;
    const finalQty = Math.max(qty, moq);
    const existing = cartItems.find(i => i.productId === currentProd.id);
    if (!existing) {
      addItem({
        productId: currentProd.id,
        sku: currentProd.sku ?? currentProd.id,
        name: currentProd.name,
        price: cartLinePrice(currentProd.price),
        priceOnEnquiry: isPriceOnEnquiry(currentProd.price) ? true : undefined,
        unit: currentProd.unit_of_measure ?? "pcs",
        imageUrl: currentProd.image_url ?? undefined,
        moq,
      });
    }
    updateQuantity(
      currentProd.id,
      existing ? existing.quantity + finalQty : finalQty
    );
    if (qty < moq) {
      toast.warning(`Minimum ${moq} — quantity bumped to MOQ`);
    } else {
      toast.success(`Added ${finalQty} to cart`);
    }
  };

  const handleCheckPin = () => {
    const pc = pincode.trim();
    if (pc.length < 6) {
      toast.error("Enter a 6-digit pincode");
      return;
    }
    setPinResult(
      pc.startsWith("395") || pc.startsWith("394")
        ? "Same-day delivery available — order by 2pm"
        : "Delivered in 2–4 days via surface transport"
    );
  };

  const handleEnquire = () => {
    if (!currentProd) return;
    const priceStr = !isPriceOnEnquiry(currentProd.price)
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

  // currentProd is null exactly when product is (it's `selectedVariant ||
  // product`, and selectedVariant is set from product on load), so guarding on
  // it is equivalent to guarding on product — and it narrows currentProd to a
  // non-null Product for the entire render below.
  if (!currentProd) {
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

      <main className="flex-1 pb-40 md:pb-0">
        <div className="container py-6">
          {/* Breadcrumb */}
          <div className="text-body-sm text-slate-500 mb-4">
            <Link href="/" className="hover:text-red-600 transition">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <Link href="/catalog" className="hover:text-red-600 transition">
              Catalogue
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-900 font-semibold">
              {currentProd.name}
            </span>
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-9">
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
            <div className="lg:sticky lg:top-24 self-start">
              <div>
                <div className="text-body-sm font-semibold text-slate-500 mb-1">
                  {[currentProd.brand, currentProd.sku && `SKU ${currentProd.sku}`]
                    .filter(Boolean)
                    .join(" · ") || "XL Traders"}
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight leading-tight text-slate-900 mb-4">
                  {currentProd.name}
                </h1>

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
                              <span className="ml-1 text-caption">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Price card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
                  {isAuthenticated ? (
                    !isPriceOnEnquiry(currentProd.price) ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-extrabold text-red-600 tabular-nums">
                          ₹{currentProd.price!.toLocaleString()}
                        </span>
                        {currentProd.quantity_in_unit ? (
                          <span className="text-body-sm text-slate-500">
                            / pack of {currentProd.quantity_in_unit}{" "}
                            {currentProd.unit_of_measure}
                          </span>
                        ) : (
                          currentProd.unit_of_measure && (
                            <span className="text-body-sm text-slate-500">
                              / {currentProd.unit_of_measure}
                            </span>
                          )
                        )}
                        {currentProd.quantity_in_unit &&
                          currentProd.quantity_in_unit > 1 && (
                            <span className="text-body-sm font-semibold text-slate-600 ml-auto">
                              ₹
                              {(
                                Math.round(
                                  (currentProd.price! /
                                    currentProd.quantity_in_unit) *
                                    100
                                ) / 100
                              ).toLocaleString()}
                              /pc
                            </span>
                          )}
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-slate-600 italic">
                        Price on enquiry
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="text-lg font-bold text-slate-700">
                        Wholesale price hidden
                      </div>
                      <button
                        onClick={() => setLocation("/auth")}
                        className="text-body-sm font-semibold text-red-600 underline mt-0.5"
                      >
                        Sign in to see your exact wholesale price
                      </button>
                    </div>
                  )}
                </div>

                {/* Quantity + Add to Cart (authenticated users — null-price
                    items enter as enquiry lines) */}
                {isAuthenticated && (
                  <div className="mb-4">
                    <div className="flex gap-3 items-end flex-wrap mb-1.5">
                      <div>
                        <div className="text-body-sm font-bold mb-2">
                          Quantity{" "}
                          {currentProd.unit_of_measure && (
                            <span className="font-medium text-slate-500">
                              ({currentProd.unit_of_measure})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center border-[1.5px] border-slate-300 rounded-xl overflow-hidden h-[46px] w-40">
                          <button
                            onClick={() => setQty(q => Math.max(1, q - 1))}
                            className="w-11 h-full bg-slate-50 hover:bg-slate-100 transition flex items-center justify-center"
                            aria-label="Decrease"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            value={qty}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) setQty(Math.max(1, v));
                            }}
                            className="flex-1 w-12 text-center text-body-md font-bold tabular-nums outline-none"
                            inputMode="numeric"
                          />
                          <button
                            onClick={() => setQty(q => q + 1)}
                            className="w-11 h-full bg-slate-50 hover:bg-slate-100 transition flex items-center justify-center"
                            aria-label="Increase"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1.5 pb-0.5">
                        {[5, 10, 25].map(n => (
                          <button
                            key={n}
                            onClick={() => setQty(q => q + n)}
                            className="px-3.5 py-3 border border-slate-200 bg-white rounded-lg text-body-sm font-bold text-slate-600 hover:border-red-600 hover:text-red-600 transition"
                          >
                            +{n}
                          </button>
                        ))}
                      </div>
                    </div>
                    {currentProd.moq != null && currentProd.moq > 1 && (
                      <div
                        className={`text-xs font-semibold mb-3.5 ${
                          qty < currentProd.moq
                            ? "text-red-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {qty < currentProd.moq
                          ? `Below MOQ — minimum ${currentProd.moq}`
                          : `✓ MOQ ${currentProd.moq} met`}
                      </div>
                    )}
                    <div className="flex gap-2.5 mt-2">
                      <button
                        onClick={handleAddToCart}
                        className="flex-1 flex items-center justify-center gap-2 h-[50px] bg-red-600 text-white rounded-xl text-body-md font-bold hover:bg-red-700 transition shadow-[0_6px_18px_rgba(220,38,38,0.28)]"
                      >
                        <ShoppingCart size={17} />
                        Add to Cart
                        {!isPriceOnEnquiry(currentProd.price) &&
                          ` · ₹${(currentProd.price! * qty).toLocaleString()}`}
                      </button>
                      <button
                        onClick={handleEnquire}
                        title="Enquire on WhatsApp"
                        className="w-[50px] h-[50px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center justify-center flex-shrink-0"
                      >
                        <MessageCircle size={20} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Anonymous: enquiry is the primary action */}
                {!isAuthenticated && (
                  <button
                    onClick={handleEnquire}
                    className="w-full flex items-center justify-center gap-2 h-[50px] bg-emerald-600 text-white rounded-xl text-body-md font-bold hover:bg-emerald-700 transition mb-4"
                  >
                    <MessageCircle size={18} />
                    Enquire on WhatsApp
                  </button>
                )}

                {/* Delivery pincode check */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4">
                  <div className="flex items-center gap-2 mb-2.5 text-body-sm font-bold">
                    <Truck size={15} className="text-emerald-600" />
                    Check delivery
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={pincode}
                      onChange={e =>
                        setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="Enter pincode"
                      inputMode="numeric"
                      className="flex-1 h-10 border border-slate-300 rounded-lg px-3 text-body-sm outline-none focus:border-red-600 bg-white"
                    />
                    <button
                      onClick={handleCheckPin}
                      className="h-10 px-4 bg-slate-900 text-white rounded-lg text-body-sm font-bold hover:bg-slate-800 transition"
                    >
                      Check
                    </button>
                  </div>
                  {pinResult && (
                    <div className="flex items-center gap-1.5 text-body-sm font-semibold text-emerald-700 mt-2">
                      <Check size={13} strokeWidth={3} />
                      {pinResult}
                    </div>
                  )}
                </div>

                {/* Trust row + secondary actions */}
                <div className="flex items-center gap-4 text-xs text-slate-600 font-medium flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-slate-500" />
                    GST invoice
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Truck size={13} className="text-slate-500" />
                    24h dispatch
                  </span>
                  <a
                    href={`tel:${phone1}`}
                    className="flex items-center gap-1.5 hover:text-red-600 transition"
                  >
                    📞 Call us
                  </a>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 hover:text-red-600 transition"
                  >
                    <Share2 size={13} />
                    Share
                  </button>
                </div>

                {/* Specifications */}
                {currentProd.specifications &&
                  Object.keys(currentProd.specifications).length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-5">
                      <h3 className="font-extrabold text-slate-900 mb-3">
                        Specifications
                      </h3>
                      <div>
                        {Object.entries(currentProd.specifications).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="grid grid-cols-[150px_1fr] gap-3 py-2 border-b border-slate-100 last:border-0 text-body-sm"
                            >
                              <span className="text-slate-500 font-medium capitalize">
                                {key}
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
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-4">
                    <h3 className="font-extrabold text-slate-900 mb-2.5">
                      Description
                    </h3>
                    <p className="text-body-sm text-slate-600 leading-relaxed">
                      {currentProd.description}
                    </p>
                  </div>
                )}
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

      {/* Sticky mobile action bar — sits above the bottom nav (prototype) */}
      <div className="md:hidden fixed bottom-16 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-2.5 flex gap-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <button
          onClick={handleEnquire}
          title="Enquire on WhatsApp"
          className="w-[52px] h-[52px] bg-emerald-600 text-white rounded-xl flex items-center justify-center flex-shrink-0"
        >
          <MessageCircle size={21} />
        </button>
        {isAuthenticated ? (
          <button
            onClick={handleAddToCart}
            className="flex-1 h-[52px] bg-red-600 text-white rounded-xl text-body-md font-extrabold shadow-[0_6px_16px_rgba(220,38,38,0.28)] flex items-center justify-center gap-2"
          >
            <ShoppingCart size={17} />
            Add to Cart
            {!isPriceOnEnquiry(currentProd.price) &&
              ` · ₹${(currentProd.price! * qty).toLocaleString()}`}
          </button>
        ) : (
          <button
            onClick={() => setLocation("/auth")}
            className="flex-1 h-[52px] bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center justify-center"
          >
            Sign in for wholesale price
          </button>
        )}
      </div>

      <Footer />
    </div>
  );
}
