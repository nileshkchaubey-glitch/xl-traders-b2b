import { Product } from "@/lib/supabase";
import { Link } from "wouter";
import { MessageCircle, Package, Minus, Plus } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { enquiryService, inquiriesService } from "@/lib/productService";
import { useCartStore } from "@/stores/cartStore";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  view?: "grid" | "list";
  onEnquire?: (product: Product) => void;
}

export default function ProductCard({
  product,
  view = "grid",
}: ProductCardProps) {
  const { isAuthenticated, user, profile } = useAuthStore();
  const { items, addItem, updateQuantity } = useCartStore();
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  const cartLine = items.find(i => i.productId === product.id);
  const moq = product.moq ?? 1;

  // Rewrite Google Drive share links (and pass other URLs through) so images
  // actually render instead of showing the broken-image placeholder. Request a
  // thumbnail sized for the slot — grid ~300px, list thumb 200px.
  const imageUrl = normalizeImageUrl(
    product.image_url,
    view === "list" ? 200 : 400
  );

  // CSS-only broken-image fallback — no React state, so a page full of broken
  // images can't trigger a cascade of re-renders.
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = "none";
    (img.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
  };
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.opacity = "1";
  };
  const revealIfComplete = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) img.style.opacity = "1";
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      sku: product.sku ?? product.id,
      name: product.name,
      price: product.price ?? 0,
      priceOnEnquiry: product.price == null ? true : undefined,
      unit: product.unit_of_measure ?? "pcs",
      imageUrl: product.image_url ?? undefined,
      moq,
    });
    if (moq > 1) {
      updateQuantity(product.id, moq);
      toast.success(`Added — ${moq} ${product.unit_of_measure ?? "pcs"} (MOQ pre-filled)`);
    } else {
      toast.success("Added to cart");
    }
  };

  const step = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartLine) updateQuantity(product.id, cartLine.quantity + delta);
  };

  const handleEnquire = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const brandLine = [product.brand, product.unit_of_measure]
    .filter(Boolean)
    .join(" · ");

  const priceBlock = isAuthenticated ? (
    product.price != null ? (
      <>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-extrabold text-red-600 tabular-nums">
            ₹{product.price.toLocaleString()}
          </span>
          {product.quantity_in_unit ? (
            <span className="text-[11.5px] text-slate-500">
              / pack of {product.quantity_in_unit}
            </span>
          ) : (
            product.unit_of_measure && (
              <span className="text-[11.5px] text-slate-500">
                / {product.unit_of_measure}
              </span>
            )
          )}
        </div>
        <div className="text-[11.5px] text-slate-500">
          {product.quantity_in_unit && product.quantity_in_unit > 1
            ? `₹${(Math.round((product.price / product.quantity_in_unit) * 100) / 100).toLocaleString()}/pc · `
            : ""}
          {product.moq ? `MOQ ${product.moq}` : "No minimum"}
        </div>
      </>
    ) : (
      <>
        <div className="text-[13px] font-bold text-slate-600 italic">
          Price on enquiry
        </div>
        <div className="text-[11.5px] text-slate-500">
          {product.moq ? `MOQ ${product.moq}` : "Ask for best rate"}
        </div>
      </>
    )
  ) : (
    <>
      <div className="text-[13px] font-bold text-slate-600">
        Wholesale price
      </div>
      <Link
        href="/auth"
        className="text-[11.5px] font-semibold text-red-600 underline"
        onClick={e => e.stopPropagation()}
      >
        Sign in for exact price
      </Link>
    </>
  );

  const cartControls = isAuthenticated ? (
    cartLine ? (
      <div className="flex items-center h-9 border-[1.5px] border-red-600 rounded-lg overflow-hidden">
        <button
          onClick={e => step(e, -1)}
          className="w-9 h-full bg-red-50 text-red-600 text-[17px] font-bold flex items-center justify-center"
          aria-label="Decrease quantity"
        >
          <Minus size={14} />
        </button>
        <div className="flex-1 text-center text-[13px] font-bold tabular-nums">
          {cartLine.quantity}
        </div>
        <button
          onClick={e => step(e, 1)}
          className="w-9 h-full bg-red-50 text-red-600 text-[17px] font-bold flex items-center justify-center"
          aria-label="Increase quantity"
        >
          <Plus size={14} />
        </button>
      </div>
    ) : (
      <button
        onClick={handleAdd}
        className="w-full h-9 bg-white text-red-600 border-[1.5px] border-red-600 rounded-lg text-[13px] font-bold hover:bg-red-600 hover:text-white transition"
      >
        Add to Cart
      </button>
    )
  ) : (
    <button
      onClick={handleEnquire}
      className="w-full h-9 bg-white text-red-600 border-[1.5px] border-red-600 rounded-lg text-[13px] font-bold hover:bg-red-600 hover:text-white transition flex items-center justify-center gap-1.5"
    >
      <MessageCircle size={13} />
      Enquire
    </button>
  );

  const image = imageUrl ? (
    <>
      <img
        ref={revealIfComplete}
        src={imageUrl}
        alt={product.image_alt_text || product.name}
        className="w-full h-full object-contain p-2 opacity-0 transition duration-300"
        loading="lazy"
        decoding="async"
        onLoad={handleImgLoad}
        onError={handleImgError}
      />
      <div className="hidden w-full h-full items-center justify-center bg-slate-100">
        <Package className="w-6 h-6 text-slate-300" />
      </div>
    </>
  ) : (
    <ImagePlaceholder className="w-full h-full" showText={false} />
  );

  if (view === "list") {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition flex">
        <Link
          href={`/product/${product.id}`}
          className="w-[120px] sm:w-[150px] flex-shrink-0 bg-slate-50 relative"
        >
          {image}
          {product.is_featured && (
            <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Featured
            </span>
          )}
        </Link>
        <div className="flex-1 p-3.5 flex flex-col min-w-0">
          <Link href={`/product/${product.id}`}>
            {brandLine && (
              <div className="text-[11.5px] font-semibold text-slate-500 mb-0.5">
                {brandLine}
              </div>
            )}
            <h3 className="text-sm font-bold text-slate-900 leading-snug hover:text-red-600 transition line-clamp-2">
              {product.name}
            </h3>
          </Link>
          <div className="mt-1.5">{priceBlock}</div>
          <div className="mt-auto pt-2.5 max-w-[220px]">{cartControls}</div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition h-full flex flex-col">
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square relative bg-slate-50">
          {image}
          {product.is_featured && (
            <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Featured
            </span>
          )}
        </div>
      </Link>
      <div className="p-3 flex-1 flex flex-col">
        <Link href={`/product/${product.id}`} className="block flex-1">
          {brandLine && (
            <div className="text-[11px] font-semibold text-slate-500 mb-0.5 truncate">
              {brandLine}
            </div>
          )}
          <h3 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2 hover:text-red-600 transition">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1.5 mb-2.5">{priceBlock}</div>
        {cartControls}
      </div>
    </div>
  );
}
