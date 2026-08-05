import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { MessageCircle, Share2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductImageSlot from "@/components/ProductImageSlot";
import { useCategoryImages } from "@/hooks/useCategoryImages";
import {
  productService,
  productImageService,
  enquiryService,
  inquiriesService,
} from "@/lib/productService";
import { masterService } from "@/lib/masterService";
import { Product, ProductImage } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { cartLinePrice, formatRupees } from "@/lib/priceUtils";
import { toCardModel } from "@/lib/cardModel";
import { sortVariantsBySize } from "@/lib/seriesModel";
import { brandLabel } from "@/lib/brandUtils";

// ─── Recently Viewed helpers ───────────────────────────────────────────────
const RECENTLY_VIEWED_KEY = "xl_recently_viewed";
const MAX_RECENT = 6;

function saveToRecentlyViewed(id: string) {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify([id, ...ids.filter(i => i !== id)].slice(0, MAX_RECENT))
    );
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

/**
 * A compact rate-card item for the "Similar" / "Recently viewed" rows. Same
 * vocabulary as the grid item — figure, name, rate rule — at row scale.
 */
function MiniProductCard({
  product,
  isAuthenticated,
}: {
  product: Product;
  isAuthenticated: boolean;
}) {
  const m = toCardModel(product, isAuthenticated);
  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex-none w-[150px] sm:w-auto"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[22px] leading-[0.9] font-bold text-ink tracking-[-0.04em] tabular-nums">
          {m.size ?? "—"}
        </span>
        {m.sizeUnit && (
          <span className="font-mono text-meta font-medium uppercase tracking-[0.14em] text-ink-faint">
            {m.sizeUnit}
          </span>
        )}
      </div>
      <div className="text-body-sm font-medium text-ink mt-2 group-hover:text-red-600 transition-colors duration-150">
        {m.name}
      </div>
      <div className="mt-2 border-t-2 border-ink flex">
        <span
          className={`font-mono text-caption font-semibold px-2 py-[5px] whitespace-nowrap text-white tabular-nums ${
            m.price.onEnquiry ? "bg-amber-600" : "bg-ink"
          }`}
        >
          {m.price.onEnquiry ? "On enquiry" : m.rateTab}
        </span>
      </div>
    </Link>
  );
}

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
    <section className="mt-11 md:mt-14">
      <h2 className="font-display text-display-sm md:text-display font-bold text-ink tracking-[-0.025em] border-t-2 border-ink pt-4">
        {title}
      </h2>
      <div className="mt-5 flex gap-[18px] overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-4 sm:gap-[30px] sm:overflow-visible">
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

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const { isAuthenticated, user, profile } = useAuthStore();
  const categoryImages = useCategoryImages();

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  const [variants, setVariants] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);

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
          // Smallest size first — the DB can only order by display_order or
          // price, neither of which is size (lib/seriesModel.ts).
          setVariants(
            sortVariantsBySize(
              await masterService.getVariantsByMasterId(prod.master_id)
            )
          );
        } else {
          setImages(await productImageService.getByProductId(id));
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
    const m = toCardModel(currentProd, isAuthenticated);
    const moq = currentProd.moq ?? 1;
    const finalQty = Math.max(qty, moq);
    const existing = cartItems.find(i => i.productId === currentProd.id);
    if (!existing) {
      addItem({
        productId: currentProd.id,
        sku: currentProd.sku ?? currentProd.id,
        name: currentProd.name,
        // Transact in the figure this viewer was actually shown.
        price: cartLinePrice(m.price.packPrice),
        priceOnEnquiry: m.price.onEnquiry ? true : undefined,
        unit: currentProd.unit_of_measure ?? "pcs",
        imageUrl: currentProd.image_url ?? undefined,
        moq,
      });
    }
    updateQuantity(
      currentProd.id,
      existing ? existing.quantity + finalQty : finalQty
    );
    if (qty < moq) toast.warning(`Minimum ${moq} — quantity bumped to MOQ`);
    else toast.success(`Added ${finalQty} to order`);
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
    const m = toCardModel(currentProd, isAuthenticated);
    const priceStr = m.price.onEnquiry
      ? "\nPrice: On enquiry"
      : `\nPrice: ${formatRupees(m.price.packPrice as number)} (${m.price.tag}) per pack`;
    // Omit the pack line entirely when pack size is missing — never print
    // "null". When only the unit is missing, fall back to "pcs".
    const packStr =
      currentProd.quantity_in_unit != null
        ? `\nPack: ${currentProd.quantity_in_unit} ${currentProd.unit_of_measure ?? "pcs"}`
        : "";
    const message = `Hi, I'm interested in: ${currentProd.name}${priceStr}${packStr}\n\nPlease share availability and your best rate.`;

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

    if (isAuthenticated && user) {
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
          quantity_requested: qty,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col text-ink">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-rule border-t-red-600 rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  // currentProd is null exactly when product is (it's `selectedVariant ||
  // product`, and selectedVariant is set from product on load), so guarding on
  // it narrows currentProd to a non-null Product for the entire render below.
  if (!currentProd) {
    return (
      <div className="min-h-screen bg-white flex flex-col text-ink">
        <Header />
        <main className="flex-1 flex items-center justify-center shell">
          <div className="text-center">
            <p className="text-body-md font-semibold mb-3">Product not found</p>
            <button
              onClick={() => setLocation("/catalog")}
              className="text-body-sm font-semibold text-red-600"
            >
              Back to catalogue →
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const model = toCardModel(currentProd, isAuthenticated);
  const { price } = model;
  const brand = brandLabel(currentProd.brand);
  const galleryUrl =
    images.length > 0
      ? normalizeImageUrl(images[selectedImageIndex]?.image_url, 900)
      : null;

  const specs = Object.entries(currentProd.specifications ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== ""
  );

  return (
    <div className="min-h-screen bg-white flex flex-col text-ink">
      <Header />

      <main className="flex-1 pb-28 md:pb-24">
        <div className="shell pt-6 md:pt-8">
          <nav className="font-mono text-caption text-ink-faint">
            <Link
              href="/"
              className="hover:text-ink transition-colors duration-150"
            >
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <Link
              href="/catalog"
              className="hover:text-ink transition-colors duration-150"
            >
              Catalogue
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">{model.name}</span>
          </nav>

          <div className="mt-4 grid lg:grid-cols-[1fr_400px] lg:gap-x-[56px]">
            {/* ── Media ── */}
            <div>
              <div className="border-t-2 border-ink pt-4">
                {galleryUrl ? (
                  <div className="w-full aspect-[3/2] bg-sunken overflow-hidden">
                    <img
                      src={galleryUrl}
                      alt={currentProd.image_alt_text || currentProd.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  // No gallery rows — fall through the same three-tier chain the
                  // grid uses, so the PDP and the card agree about this product.
                  <ProductImageSlot
                    product={currentProd}
                    categoryImageUrl={categoryImages[currentProd.category_id]}
                    size={model.size}
                    sizeUnit={model.sizeUnit}
                    sizeIsPackCount={model.sizeIsPackCount}
                  />
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageIndex(i)}
                      aria-label={`View image ${i + 1}`}
                      className={`w-16 h-16 flex-none bg-sunken overflow-hidden border-2 transition-colors duration-150 ${
                        i === selectedImageIndex
                          ? "border-ink"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={normalizeImageUrl(img.image_url, 160) ?? ""}
                        alt={img.alt_text || ""}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Buy panel ── */}
            <div className="mt-7 lg:mt-0 lg:sticky lg:top-6 self-start">
              <div className="border-t-2 border-ink pt-4">
                {brand && (
                  <div className="font-mono text-meta font-medium uppercase tracking-[0.14em] text-ink-faint mb-2">
                    {brand}
                  </div>
                )}
                <h1 className="font-display text-display-sm md:text-display font-bold tracking-[-0.025em]">
                  {model.name}
                </h1>

                <div className="font-mono text-caption md:text-micro font-medium uppercase tracking-[0.06em] text-ink-faint mt-3 tabular-nums">
                  {[
                    currentProd.quantity_in_unit
                      ? `${currentProd.quantity_in_unit.toLocaleString("en-IN")} ${currentProd.unit_of_measure ?? "pcs"}/pack`
                      : null,
                    model.size && !model.sizeIsPackCount
                      ? `${model.size} ${model.sizeUnit ?? ""}`.trim()
                      : null,
                    currentProd.sku,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>

              {/* Variant selector */}
              {variants.length > 1 && (
                <div className="mt-5">
                  <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2.5">
                    Size
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVariant(v);
                          window.history.replaceState(
                            null,
                            "",
                            `/product/${v.id}`
                          );
                        }}
                        className={`h-9 px-3.5 text-body-sm font-medium border transition-colors duration-150 ${
                          v.id === currentProd.id
                            ? "bg-ink text-white border-ink"
                            : "bg-white text-ink-muted border-rule hover:border-ink"
                        }`}
                      >
                        {v.variant_label || v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── The rate rule, at PDP scale ── */}
              <div className="mt-6 border-t-2 border-ink flex">
                <span
                  className={`font-mono text-body-sm font-semibold px-[9px] py-1.5 whitespace-nowrap text-white tabular-nums ${
                    price.onEnquiry ? "bg-amber-600" : "bg-ink"
                  }`}
                >
                  {price.onEnquiry ? "On enquiry" : model.rateTab}
                </span>
              </div>

              {price.onEnquiry ? (
                <p className="text-body-sm text-ink-muted mt-3.5 max-w-sm">
                  Rate depends on quantity — ask on WhatsApp and we'll quote for
                  your volume.
                </p>
              ) : (
                <>
                  <div className="font-mono text-price-lg font-bold text-ink mt-3.5 tracking-[-0.025em] tabular-nums">
                    {formatRupees(price.packPrice as number)}
                  </div>
                  <div className="text-caption font-medium uppercase tracking-[0.1em] text-ink-faint mt-1.5">
                    {price.tag} · per pack
                  </div>
                </>
              )}

              {/* Quantity */}
              <div className="mt-6">
                <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2.5">
                  Packs
                </div>
                <div className="flex items-stretch h-[46px] border-2 border-ink w-[150px]">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-12 flex items-center justify-center font-mono text-body-md font-semibold hover:bg-sunken transition-colors duration-150"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={qty}
                    onChange={e => {
                      const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                      setQty(Number.isFinite(n) && n > 0 ? n : 1);
                    }}
                    aria-label="Quantity in packs"
                    className="flex-1 min-w-0 text-center font-mono text-body-md font-bold outline-none tabular-nums"
                  />
                  <button
                    onClick={() => setQty(q => q + 1)}
                    aria-label="Increase quantity"
                    className="w-12 flex items-center justify-center font-mono text-body-md font-semibold hover:bg-sunken transition-colors duration-150"
                  >
                    +
                  </button>
                </div>
                {currentProd.moq && currentProd.moq > 1 && (
                  <p className="font-mono text-caption text-ink-faint mt-2 tabular-nums">
                    Minimum order {currentProd.moq} packs
                  </p>
                )}
                {!price.onEnquiry && (
                  <p className="font-mono text-body-sm font-medium text-ink mt-2.5 tabular-nums">
                    {formatRupees((price.packPrice as number) * qty)} total
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  onClick={handleAddToCart}
                  className="w-full h-[46px] bg-ink text-white text-body-md font-semibold hover:bg-red-600 transition-colors duration-150"
                >
                  Add to order
                </button>
                <div className="flex gap-2.5">
                  <button
                    onClick={handleEnquire}
                    className="flex-1 h-[46px] flex items-center justify-center gap-2 border border-rule text-wa text-body-sm font-semibold hover:border-wa transition-colors duration-150"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleShare}
                    aria-label="Share this product"
                    className="w-[46px] h-[46px] flex items-center justify-center border border-rule text-ink-faint hover:border-ink hover:text-ink transition-colors duration-150"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>

              {/* Delivery check */}
              <div className="mt-7 border-t border-rule pt-4">
                <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2.5">
                  Delivery
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pincode}
                    onChange={e =>
                      setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={e => e.key === "Enter" && handleCheckPin()}
                    placeholder="Pincode"
                    aria-label="Delivery pincode"
                    className="flex-1 min-w-0 h-10 px-3 border border-rule font-mono text-body-sm outline-none focus:border-ink transition-colors duration-150 tabular-nums"
                  />
                  <button
                    onClick={handleCheckPin}
                    className="flex-none px-4 h-10 border border-ink text-body-sm font-semibold hover:bg-ink hover:text-white transition-colors duration-150"
                  >
                    Check
                  </button>
                </div>
                {pinResult && (
                  <p className="text-body-sm text-ink-muted mt-2.5">
                    {pinResult}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Specifications + description ── */}
          {(specs.length > 0 || currentProd.description) && (
            <section className="mt-11 md:mt-14 grid md:grid-cols-2 md:gap-x-[56px]">
              {specs.length > 0 && (
                <div>
                  <h2 className="font-display text-display-sm font-bold border-t-2 border-ink pt-4 tracking-[-0.025em]">
                    Specifications
                  </h2>
                  <dl className="mt-3">
                    {specs.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between gap-4 border-b border-rule-soft py-2.5"
                      >
                        <dt className="text-body-sm text-ink-faint">{k}</dt>
                        <dd className="font-mono text-body-sm text-ink text-right tabular-nums">
                          {String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {currentProd.description && (
                <div className={specs.length > 0 ? "mt-9 md:mt-0" : ""}>
                  <h2 className="font-display text-display-sm font-bold border-t-2 border-ink pt-4 tracking-[-0.025em]">
                    Description
                  </h2>
                  <p className="mt-3 text-body-sm text-ink-muted leading-relaxed whitespace-pre-line">
                    {currentProd.description}
                  </p>
                </div>
              )}
            </section>
          )}

          <ProductRow
            title="Similar products"
            products={similarProducts}
            isAuthenticated={isAuthenticated}
          />
          <ProductRow
            title="Recently viewed"
            products={recentlyViewed}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
