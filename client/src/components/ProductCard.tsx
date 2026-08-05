import { Product } from "@/lib/supabase";
import { Link } from "wouter";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/stores/cartStore";
import ProductImageSlot from "./ProductImageSlot";
import { toCardModel } from "@/lib/cardModel";
import { cartLinePrice, formatRupees } from "@/lib/priceUtils";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  /** Tier-2 image source for this product's category, from useCategoryImages(). */
  categoryImageUrl?: string;
}

/**
 * The rate-card item (docs/DESIGN_SYSTEM.md §3.1).
 *
 * De-carded: no border, no rounded corner, no shadow, no hover lift. Items sit
 * in open whitespace and are held together by ONE piece of structure — the rate
 * rule: a 2px ink rule under the product name with the per-piece rate hanging
 * off it as a solid tab. That tab marks the one number that separates two
 * identical black containers, which is why it is the only filled shape on the
 * item. Products with no rate carry an amber tab on the same rule.
 *
 * Numbers carry the weight; the product name is set at 500 and stays quiet.
 *
 * There is ONE component tree for both breakpoints — Tailwind `md:` only, no
 * `useIsMobile` fork.
 */
export default function ProductCard({
  product,
  categoryImageUrl,
}: ProductCardProps) {
  const { isAuthenticated } = useAuthStore();
  const { items, addItem, updateQuantity } = useCartStore();

  const model = toCardModel(product, isAuthenticated);
  const { price } = model;
  const cartLine = items.find(i => i.productId === product.id);
  const moq = product.moq ?? 1;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      sku: product.sku ?? product.id,
      name: product.name,
      // The cart always transacts in the SELLING-UNIT price the viewer was
      // shown. cartLinePrice zeroes on-enquiry lines so a total never counts a
      // figure nobody quoted.
      price: cartLinePrice(price.packPrice),
      priceOnEnquiry: price.onEnquiry ? true : undefined,
      unit: product.unit_of_measure ?? "pcs",
      imageUrl: product.image_url ?? undefined,
      moq,
    });
    if (moq > 1) {
      updateQuantity(product.id, moq);
      toast.success(`Added — ${moq} packs (MOQ pre-filled)`);
    } else {
      toast.success("Added to order");
    }
  };

  const step = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartLine) updateQuantity(product.id, cartLine.quantity + delta);
  };

  return (
    <div className="flex flex-col">
      <Link href={`/product/${product.id}`} className="block group">
        <ProductImageSlot
          product={product}
          categoryImageUrl={categoryImageUrl}
          size={model.size}
          sizeUnit={model.sizeUnit}
          sizeIsPackCount={model.sizeIsPackCount}
        />
        {/* Never truncated. On a catalogue of near-identical black containers
            the tail of a name is often the only thing distinguishing two SKUs. */}
        <div className="mt-3 text-body-sm md:text-body-md font-medium text-ink group-hover:text-red-600 transition-colors duration-150">
          {model.name}
        </div>
      </Link>

      {/* ── The rate rule ── */}
      <div className="mt-3 md:mt-[15px] border-t-2 border-ink flex">
        {price.onEnquiry ? (
          <span className="bg-amber-600 text-white font-mono text-caption md:text-body-sm font-semibold px-2 py-[5px] md:px-[9px] md:py-1.5 whitespace-nowrap">
            On enquiry
          </span>
        ) : (
          <span className="bg-ink text-white font-mono text-caption md:text-body-sm font-semibold px-2 py-[5px] md:px-[9px] md:py-1.5 whitespace-nowrap tabular-nums">
            {model.rateTab}
          </span>
        )}
      </div>

      {/* flex-1 pushes the action to the bottom, so every item in a grid row
          lands its button on the same line without a fixed card height. */}
      <div className="flex-1">
        {price.onEnquiry ? (
          // ONE short line, not the design board's sentence. At 390 the grid is
          // two columns, so a two-line paragraph repeated on every card put the
          // words "ask on WhatsApp." side by side at the same y on every row —
          // which read as a duplicated-text bug and ate most of the card. The
          // amber tab above already says "On enquiry"; this only needs to say
          // where the answer comes from.
          <p className="font-mono text-caption md:text-micro text-ink-faint mt-3">
            Quantity-based
          </p>
        ) : (
          <>
            <div className="font-mono text-price md:text-price-lg font-bold text-ink mt-3 tracking-[-0.025em] tabular-nums">
              {formatRupees(price.packPrice as number)}
            </div>
            {/* Pack price and per-piece rate always travel together: the tab
                above carries the rate, this line names what the figure is. */}
            <div className="text-meta md:text-caption font-medium uppercase tracking-[0.1em] text-ink-faint mt-1.5">
              {price.tag} · per pack
            </div>
          </>
        )}
      </div>

      {cartLine ? (
        <div className="mt-3.5 md:mt-4 h-[38px] md:h-[46px] flex items-stretch border-2 border-ink">
          <button
            onClick={e => step(e, -1)}
            aria-label={`Decrease quantity of ${model.name}`}
            className="w-10 md:w-12 flex items-center justify-center text-ink font-mono text-body-md font-semibold hover:bg-sunken transition-colors duration-150"
          >
            −
          </button>
          <span className="flex-1 flex items-center justify-center font-mono text-body-sm md:text-body-md font-bold text-ink tabular-nums">
            {cartLine.quantity}
          </span>
          <button
            onClick={e => step(e, 1)}
            aria-label={`Increase quantity of ${model.name}`}
            className="w-10 md:w-12 flex items-center justify-center text-ink font-mono text-body-md font-semibold hover:bg-sunken transition-colors duration-150"
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          className="mt-3.5 md:mt-4 w-full h-[38px] md:h-[46px] bg-ink text-white text-body-sm md:text-body-md font-semibold hover:bg-red-600 transition-colors duration-150"
        >
          {/* Enquiry items still add to the order — the cart carries them as
              enquiry lines and the WhatsApp message asks for the rate. */}
          <span className="md:hidden">Add</span>
          <span className="hidden md:inline">Add to order</span>
        </button>
      )}
    </div>
  );
}
