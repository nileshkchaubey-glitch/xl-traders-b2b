import { Product } from "@/lib/supabase";
import { Link } from "wouter";
import { MessageCircle, Package } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { enquiryService, inquiriesService } from "@/lib/productService";
import { ImagePlaceholder } from "./ImagePlaceholder";
import AddToCartButton from "./cart/AddToCartButton";
import { normalizeImageUrl } from "@/lib/imageUtils";

interface ProductCardProps {
  product: Product;
  view?: "grid" | "list";
  onEnquire?: (product: Product) => void;
}

export default function ProductCard({
  product,
  view = "grid",
  onEnquire,
}: ProductCardProps) {
  const { isAuthenticated, user, profile } = useAuthStore();
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  // Rewrite Google Drive share links (and pass other URLs through) so images
  // actually render instead of showing the broken-image placeholder.
  // Request a thumbnail sized for the slot it renders into instead of the full
  // 1000px default — grid cards are ~170px wide and the list thumb is 96px, so
  // pulling 1000px images wastes bandwidth and slows the grid on mobile. The
  // smaller widths still cover retina (2x) and the detail page keeps full size.
  const imageUrl = normalizeImageUrl(
    product.image_url,
    view === "list" ? 200 : 400
  );

  // CSS-only broken-image fallback — no React state, so a page full of broken
  // images can't trigger a cascade of re-renders. onError hides the <img> and
  // reveals its sibling placeholder.
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = "none";
    (img.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
  };

  // Fade each thumbnail in once it decodes (Drive thumbnails can be slow) so the
  // grid doesn't pop. State-free, matching the onError pattern above. Cached
  // images that are already complete render at full opacity immediately.
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.opacity = "1";
  };
  // A cached image can already be `complete` before React attaches onLoad, so
  // onLoad would never fire and it'd stay invisible. Reveal those immediately
  // via a ref callback; the rest fade in on load.
  const revealIfComplete = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) img.style.opacity = "1";
  };
  // Start transparent; the image's existing `transition duration-300` animates
  // opacity back to 1 on load. No extra transition utility (would conflict).
  const fadeInClass = "opacity-0";

  const handleEnquire = () => {
    const priceStr = product.price != null ? `Price: ₹${product.price}. ` : "";
    const message = isAuthenticated
      ? `Hi, I'm interested in: ${product.name}. ${priceStr}Please provide more details.`
      : `Hi, I'm interested in: ${product.name}. Could you please share the price and more details?`;

    // Open WhatsApp immediately — stays in synchronous click context.
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    // Fire-and-forget DB logging.
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
        product_name: product.name,
        source: "website",
      })
      .catch(() => {});

    if (isAuthenticated && user) {
      enquiryService
        .create({
          user_id: user.id,
          product_id: product.id,
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

  if (view === "list") {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-slate-300 transition flex">
        {/* Image */}
        <Link
          href={`/product/${product.id}`}
          className="w-24 h-24 flex-shrink-0 overflow-hidden bg-slate-50"
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={product.image_alt_text || product.name}
                width={96}
                height={96}
                className="w-full h-full object-contain p-1.5"
                loading="lazy"
                decoding="async"
                onError={handleImgError}
              />
              <div className="hidden w-full h-full flex items-center justify-center bg-slate-100">
                <Package className="w-6 h-6 text-slate-300" />
              </div>
            </>
          ) : (
            <ImagePlaceholder className="w-24 h-24" showText={false} />
          )}
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

          {/* Price & Actions */}
          <div className="flex-shrink-0 text-right space-y-2">
            {isAuthenticated ? (
              product.price != null ? (
                <p className="font-bold text-red-600 text-sm">
                  ₹{product.price.toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-slate-500 font-semibold italic">
                  Price on enquiry
                </p>
              )
            ) : (
              <p className="text-xs text-slate-500 font-semibold">
                Login to see price
              </p>
            )}
            <div className="flex gap-1.5 justify-end">
              {isAuthenticated && <AddToCartButton product={product} compact />}
              <button
                onClick={handleEnquire}
                className="px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-red-600 hover:text-white hover:border-red-600 transition flex items-center gap-1 whitespace-nowrap"
              >
                <MessageCircle size={12} />
                Enquire
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-slate-300 transition h-full flex flex-col">
      {/* Image */}
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square overflow-hidden relative group flex-shrink-0 bg-slate-50">
          {imageUrl ? (
            <>
              <img
                ref={revealIfComplete}
                src={imageUrl}
                alt={product.image_alt_text || product.name}
                width={400}
                height={400}
                className={`w-full h-full object-contain p-2 group-hover:scale-105 transition duration-300 ${fadeInClass}`}
                loading="lazy"
                decoding="async"
                onLoad={handleImgLoad}
                onError={handleImgError}
              />
              <div className="hidden w-full h-full flex items-center justify-center bg-slate-100">
                <Package className="w-6 h-6 text-slate-300" />
              </div>
            </>
          ) : (
            <ImagePlaceholder className="w-full h-full" showText={false} />
          )}
          {product.is_featured && (
            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
              Featured
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-2 flex-1 flex flex-col">
        {product.quantity_in_unit ? (
          <p className="text-[10px] text-slate-500 font-medium mb-0.5">
            Pack of {product.quantity_in_unit} {product.unit_of_measure}
          </p>
        ) : null}
        <Link href={`/product/${product.id}`} className="block flex-1 mb-1.5">
          <h3 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-tight hover:text-red-600 transition">
            {product.name}
          </h3>
        </Link>

        {/* Price */}
        <div className="mb-1.5">
          {isAuthenticated ? (
            product.price != null ? (
              <p className="font-bold text-red-600 text-sm leading-none">
                ₹{product.price.toLocaleString()}
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 font-semibold italic">
                Price on enquiry
              </p>
            )
          ) : (
            <p className="text-[10px] text-slate-500 font-semibold">
              Sign in for price
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="space-y-1">
          {isAuthenticated && <AddToCartButton product={product} compact />}
          <button
            onClick={handleEnquire}
            className="w-full px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-red-600 hover:text-white hover:border-red-600 transition flex items-center justify-center gap-1"
          >
            <MessageCircle size={12} />
            Enquire
          </button>
        </div>
      </div>
    </div>
  );
}
