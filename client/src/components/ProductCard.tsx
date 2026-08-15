import { Product } from "@/lib/supabase";
import { Link } from "wouter";
import { MessageCircle, Package, Minus, Plus } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { enquiryService, inquiriesService } from "@/lib/productService";
import { useCartStore } from "@/stores/cartStore";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry, cartLinePrice } from "@/lib/priceUtils";
import { resolveOrderSpec, stepPacks, initialPacks } from "@/lib/orderingModel";
import { brandLabel } from "@/lib/brandUtils";
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
  const { items, addItem, setPacks } = useCartStore();
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  const cartLine = items.find(i => i.productId === product.id);
  // The single source for this product's ordering rules. Nothing below reads
  // order_unit / order_step / quantity_in_unit / moq directly.
  const spec = resolveOrderSpec(product);
  const moq = spec.minPacks;

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
    // Seed at the MOQ in one step, rather than adding 1 and then correcting it.
    addItem(
      {
        productId: product.id,
        sku: product.sku ?? product.id,
        name: product.name,
        price: cartLinePrice(product.price),
        priceOnEnquiry: isPriceOnEnquiry(product.price) ? true : undefined,
        unit: product.unit_of_measure ?? "pcs",
        imageUrl: product.image_url ?? undefined,
        moq,
        orderUnit: spec.unit,
        packSize: spec.packSize,
        orderStep: spec.step,
      },
      initialPacks(spec)
    );
    if (moq > 1) {
      toast.success(`Added — ${moq} ${product.unit_of_measure ?? "pcs"} (MOQ pre-filled)`);
    } else {
      toast.success("Added to cart");
    }
  };

  const step = (e: React.MouseEvent, delta: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartLine) setPacks(product.id, stepPacks(cartLine.packs, delta, spec));
  };

  const handleEnquire = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const priceStr = !isPriceOnEnquiry(product.price)
      ? `Price: ₹${product.price}. `
      : "";
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

  // Brand only — unit_of_measure used to be appended here, which rendered as
  // "Fortune Petpack · pcs". The unit is not brand information; pack size now
  // lives in the spec line below. 'Generic' is a null-brand placeholder and is
  // suppressed by brandLabel (docs/STYLE_REFERENCE.md §4.4).
  const brandLine = brandLabel(product.brand);

  // Permanent spec line (docs/STYLE_REFERENCE.md §3.1 #7, §2.2-B2). Our SKUs
  // look alike — black containers, white cups — so pack size + MOQ is the card's
  // primary differentiator, not decoration. It renders in every auth state:
  // signed-out visitors never see the price block's detail, so without this they
  // get no pack or MOQ information at all. Never truncated.
  // quantity_in_unit counts PIECES inside one selling unit, so "pcs" is literal
  // here and is not unit_of_measure (CLAUDE.md, unit-of-sale canonical rule).
  const specLine = [
    product.quantity_in_unit ? `${product.quantity_in_unit} pcs/pack` : null,
    product.moq ? `MOQ ${product.moq}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const priceBlock = isAuthenticated ? (
    !isPriceOnEnquiry(product.price) ? (
      <>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-extrabold text-red-600 tabular-nums">
            ₹{product.price!.toLocaleString()}
          </span>
          {product.quantity_in_unit ? (
            // Just "/pack" — the spec line above already states the pack size,
            // so "/ pack of 480" would repeat it two lines apart.
            <span className="text-caption text-slate-500">/pack</span>
          ) : (
            product.unit_of_measure && (
              <span className="text-caption text-slate-500">
                / {product.unit_of_measure}
              </span>
            )
          )}
        </div>
        {/* Per-piece stays derived, never stored, and keeps its divisor guard
            so a missing/1 quantity_in_unit can't print a bogus rate. MOQ moved
            up to the spec line, where signed-out visitors can see it too. */}
        {product.quantity_in_unit && product.quantity_in_unit > 1 && (
          <div className="text-caption text-slate-500">
            {`₹${(Math.round((product.price! / product.quantity_in_unit) * 100) / 100).toLocaleString()}/pc`}
          </div>
        )}
      </>
    ) : (
      // Amber is the documented On-Enquiry colour (docs/DESIGN_SYSTEM.md §1.3,
      // STYLE_REFERENCE §3.1) — this rendered slate italic before.
      <div className="text-body-sm font-bold text-amber-700">
        Price on enquiry
      </div>
    )
  ) : (
    <>
      <div className="text-body-sm font-bold text-slate-600">
        Wholesale price
      </div>
      <Link
        href="/auth"
        className="text-caption font-semibold text-red-600 underline"
        onClick={e => e.stopPropagation()}
      >
        Sign in for rates
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
        <div className="flex-1 text-center text-body-sm font-bold tabular-nums">
          {cartLine.packs}
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
        className="w-full h-9 bg-white text-red-600 border-[1.5px] border-red-600 rounded-lg text-body-sm font-bold hover:bg-red-600 hover:text-white transition"
      >
        Add to Cart
      </button>
    )
  ) : (
    <button
      onClick={handleEnquire}
      className="w-full h-9 bg-white text-red-600 border-[1.5px] border-red-600 rounded-lg text-body-sm font-bold hover:bg-red-600 hover:text-white transition flex items-center justify-center gap-1.5"
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
        className="w-full h-full object-contain p-2 opacity-0 transition duration-300 motion-safe:group-hover:scale-[1.04]"
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
      <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-red-200 transition flex">
        <Link
          href={`/product/${product.id}`}
          className="w-[120px] sm:w-[150px] flex-shrink-0 bg-slate-50 relative overflow-hidden"
        >
          {image}
          {product.is_featured && (
            <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-caption font-bold px-2 py-0.5 rounded-full">
              Featured
            </span>
          )}
        </Link>
        <div className="flex-1 p-3.5 flex flex-col min-w-0">
          <Link href={`/product/${product.id}`}>
            {brandLine && (
              <div className="text-caption font-semibold text-slate-500 mb-0.5">
                {brandLine}
              </div>
            )}
            <h3 className="text-sm font-bold text-slate-900 leading-snug hover:text-red-600 transition line-clamp-2">
              {product.name}
            </h3>
          </Link>
          {specLine && (
            <div className="text-caption text-slate-600 mt-1">{specLine}</div>
          )}
          <div className="mt-1.5">{priceBlock}</div>
          <div className="mt-auto pt-2.5 max-w-[220px]">{cartControls}</div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-red-200 motion-safe:hover:-translate-y-0.5 transition h-full flex flex-col">
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square relative bg-slate-50 overflow-hidden">
          {image}
          {product.is_featured && (
            <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-caption font-bold px-2 py-0.5 rounded-full">
              Featured
            </span>
          )}
        </div>
      </Link>
      <div className="p-3 flex-1 flex flex-col">
        <Link href={`/product/${product.id}`} className="block flex-1">
          {brandLine && (
            <div className="text-caption font-semibold text-slate-500 mb-0.5 truncate">
              {brandLine}
            </div>
          )}
          <h3 className="text-body-sm font-bold text-slate-900 leading-snug line-clamp-2 hover:text-red-600 transition">
            {product.name}
          </h3>
        </Link>
        {specLine && (
          <div className="text-caption text-slate-600 mt-1">{specLine}</div>
        )}
        <div className="mt-1.5 mb-2.5">{priceBlock}</div>
        {cartControls}
      </div>
    </div>
  );
}
