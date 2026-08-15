import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/stores/cartStore";
import { useProductEnquiry } from "@/hooks/useProductEnquiry";
import { useDispatchLine } from "@/hooks/useDispatchLine";
import { isPriceOnEnquiry, cartLinePrice } from "@/lib/priceUtils";
import { brandLabel } from "@/lib/brandUtils";
import {
  type Packs,
  resolveOrderSpec,
  initialPacks,
  formatOrderQty,
} from "@/lib/orderingModel";
import ProductImage from "./storefront/ProductImage";
import PriceSlot from "./storefront/PriceSlot";
import QtyStepper from "./storefront/QtyStepper";
import { PackChip, MoqChip, DispatchLine } from "./storefront/ProductMeta";

interface ProductCardProps {
  product: Product;
  view?: "grid" | "list";
  /** Above-the-fold cards load their image eagerly. */
  priority?: boolean;
}

/**
 * The product card. Everything else in the storefront inherits its vocabulary
 * from this component, so the rules it holds are worth stating:
 *
 *  * IMAGE-DOMINANT. The photo is the largest element; on a catalogue of
 *    near-identical black containers it is the only fast differentiator.
 *  * PACK CHIP top-left OVER the image ("Box of 900"), MOQ chip in the body.
 *    Both render for guests — `moq` is granted to anon (V3 Phase 2).
 *  * ACTION bottom-right, OVERLAPPING the image. Add and the stepper occupy an
 *    identical footprint so converting one into the other shifts nothing.
 *  * QUANTITY IN PIECES for pcs products; the stepper owns that conversion.
 *  * GUEST SEES NO PRICE — "Sign in for rates", at IDENTICAL CARD HEIGHT to the
 *    signed-in state (PriceSlot pins its own height).
 *  * NO arithmetic here. Every pack/pcs/money figure comes from orderingModel.
 */
export default function ProductCard({
  product,
  view = "grid",
  priority = false,
}: ProductCardProps) {
  const { isAuthenticated } = useAuthStore();
  const items = useCartStore(s => s.items);
  const addItem = useCartStore(s => s.addItem);
  const setPacks = useCartStore(s => s.setPacks);
  const enquire = useProductEnquiry();
  const dispatchLine = useDispatchLine();

  const spec = resolveOrderSpec(product);
  const line = items.find(i => i.productId === product.id);
  const brand = brandLabel(product.brand);
  const href = `/product/${product.id}`;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAdd = (e: React.MouseEvent) => {
    stop(e);
    const seed = initialPacks(spec);
    addItem(
      {
        productId: product.id,
        sku: product.sku ?? product.id,
        name: product.name,
        price: cartLinePrice(product.price),
        priceOnEnquiry: isPriceOnEnquiry(product.price) ? true : undefined,
        unit: product.unit_of_measure ?? "pcs",
        imageUrl: product.image_url ?? undefined,
        moq: spec.minPacks,
        orderUnit: spec.unit,
        packSize: spec.packSize,
        orderStep: spec.step,
      },
      seed
    );
    const { primary } = formatOrderQty(seed, spec);
    toast.success(
      spec.minPacks > 1 || spec.unit === "pcs"
        ? `Added ${primary} — minimum order`
        : `Added ${primary}`
    );
  };

  const handleChange = (packs: Packs) => setPacks(product.id, packs);

  // The action slot. Add and the stepper are both h-9 w-[124px], so swapping
  // between them cannot move a single pixel of the card — that identity is the
  // whole reason the sizes are pinned rather than content-driven.
  const action = !isAuthenticated ? (
    <button
      onClick={e => {
        stop(e);
        enquire(product);
      }}
      className="h-9 w-[124px] rounded-lg bg-white/95 backdrop-blur-sm border-[1.5px] border-red-600 text-red-600 text-[12.5px] font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-red-600 hover:text-white transition"
    >
      <MessageCircle size={13} />
      Enquire
    </button>
  ) : line ? (
    <QtyStepper packs={line.packs} spec={spec} onChange={handleChange} />
  ) : (
    <button
      onClick={handleAdd}
      className="h-9 w-[124px] rounded-lg bg-red-600 text-white text-[12.5px] font-bold shadow-sm hover:bg-red-700 transition"
    >
      Add
    </button>
  );

  const imageSlot = (
    <div className="relative">
      <ProductImage
        url={product.image_url}
        alt={product.image_alt_text || product.name}
        slotPx={view === "list" ? 200 : 400}
        aspect={view === "list" ? "aspect-square" : "aspect-[4/3]"}
        priority={priority}
      />
      <PackChip spec={spec} />
      {product.is_featured && (
        <span className="absolute top-2.5 right-2.5 z-10 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
          Featured
        </span>
      )}
      {/* Overlaps the image bottom edge, hanging into the body below it. */}
      <div className="absolute -bottom-4 right-2.5 z-20">{action}</div>
    </div>
  );

  const body = (
    <div className="flex flex-1 flex-col px-3 pb-3 pt-5">
      {brand && (
        <div className="truncate text-caption font-semibold uppercase tracking-wide text-slate-400">
          {brand}
        </div>
      )}
      <Link
        href={href}
        className="text-body-sm font-bold leading-snug text-slate-900 line-clamp-2 hover:text-red-600 transition"
      >
        {product.name}
      </Link>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <MoqChip spec={spec} />
        {spec.unit === "pcs" && line && (
          <span className="text-[10.5px] font-semibold text-slate-500 tabular-nums">
            {formatOrderQty(line.packs, spec).secondary}
          </span>
        )}
      </div>

      <div className="mt-2">
        <PriceSlot
          price={product.price}
          spec={spec}
          isAuthenticated={isAuthenticated}
          onLinkClick={e => e.stopPropagation()}
        />
      </div>

      <div className="mt-auto pt-1.5">
        <DispatchLine line={dispatchLine} />
      </div>
    </div>
  );

  if (view === "list") {
    return (
      <div className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-red-200 hover:shadow-lg">
        <Link href={href} className="w-[140px] flex-shrink-0 sm:w-[170px]">
          {imageSlot}
        </Link>
        {body}
      </div>
    );
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-red-200 hover:shadow-lg motion-safe:hover:-translate-y-0.5">
      <Link href={href} className="block">
        {imageSlot}
      </Link>
      {body}
    </div>
  );
}
