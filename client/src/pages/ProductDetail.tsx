import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import ProductCard from "@/components/ProductCard";
import ProductImage from "@/components/storefront/ProductImage";
import PriceSlot from "@/components/storefront/PriceSlot";
import QtyStepper from "@/components/storefront/QtyStepper";
import OrderRule from "@/components/storefront/OrderRule";
import VariantSelector from "@/components/storefront/VariantSelector";
import {
  PackChip,
  MoqChip,
  DispatchLine,
} from "@/components/storefront/ProductMeta";

import type { Product, ProductImage as ProductImageRow } from "@/lib/supabase";
import { productService, productImageService } from "@/lib/productService";
import { masterService } from "@/lib/masterService";
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
  lineTotal,
} from "@/lib/orderingModel";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const addItem = useCartStore(s => s.addItem);
  const enquire = useProductEnquiry();
  const dispatchLine = useDispatchLine();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImageRow[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [packs, setPacksState] = useState<Packs>(
    initialPacks(resolveOrderSpec(null))
  );

  // The row every field is read from — the chosen variant, or the product
  // itself when it is standalone. Ordering is ALWAYS per-variant.
  const current = selected ?? product;
  const spec = useMemo(() => resolveOrderSpec(current), [current]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const prod = await productService.getById(id);
        if (cancelled) return;
        setProduct(prod);
        setSelected(prod);

        if (prod?.master_id) {
          const [masterImgs, siblings] = await Promise.all([
            masterService.getMasterImages(prod.master_id),
            masterService.getVariantsByMasterId(prod.master_id),
          ]);
          if (cancelled) return;
          setImages(
            masterImgs.map(img => ({
              id: img.id,
              product_id: prod.id,
              image_url: img.image_url,
              display_order: img.display_order,
              created_at: img.created_at,
            }))
          );
          setVariants(siblings);
        } else {
          const imgs = await productImageService.getByProductId(id);
          if (cancelled) return;
          setImages(imgs);
          setVariants([]);
        }

        if (prod?.category_id) {
          const related = await productService.getAll({
            categoryId: prod.category_id,
            pageSize: 5,
          });
          if (!cancelled) {
            setSimilar(related.filter(p => p.id !== id).slice(0, 4));
          }
        }
      } catch (err) {
        console.error("Error loading product:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Reset the quantity to the NEW variant's minimum on every switch. Never
  // carry a count across: 6000 pcs is 2 packs of one variant and 6 of another,
  // so carrying it would silently triple the order (ORDERING_MODEL §6.4).
  useEffect(() => {
    setPacksState(initialPacks(spec));
    setImageIndex(0);
  }, [current?.id, spec]);

  if (loading) {
    return (
      <Shell>
        <div className="container flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </Shell>
    );
  }

  if (!current) {
    return (
      <Shell>
        <div className="container py-20 text-center">
          <h1 className="text-xl font-extrabold">Product not found</h1>
          <Link
            href="/catalog"
            className="mt-3 inline-block font-bold text-red-600"
          >
            Browse the catalogue →
          </Link>
        </div>
      </Shell>
    );
  }

  const gallery = images.length
    ? images.map(i => i.image_url)
    : current.image_url
      ? [current.image_url]
      : [];
  const heroImage = gallery[imageIndex] ?? current.image_url;
  const onEnquiry = isPriceOnEnquiry(current.price);
  const brand = brandLabel(current.brand);
  const qtyLabel = formatOrderQty(packs, spec);
  const total = lineTotal(packs, current.price);

  const addToCart = () => {
    addItem(
      {
        productId: current.id,
        sku: current.sku ?? current.id,
        name: current.name,
        price: cartLinePrice(current.price),
        priceOnEnquiry: onEnquiry ? true : undefined,
        unit: current.unit_of_measure ?? "pcs",
        imageUrl: current.image_url ?? undefined,
        moq: spec.minPacks,
        orderUnit: spec.unit,
        packSize: spec.packSize,
        orderStep: spec.step,
      },
      packs
    );
    toast.success(`Added ${qtyLabel.primary} to cart`);
  };

  const specs = current.specifications ?? {};
  const hasSpecs = Object.keys(specs).length > 0;

  return (
    <Shell>
      <div className="container py-5">
        <nav className="mb-4 flex items-center gap-1 text-caption text-slate-500">
          <Link href="/" className="hover:text-red-600">
            Home
          </Link>
          <ChevronRight size={12} />
          <Link href="/catalog" className="hover:text-red-600">
            Catalogue
          </Link>
          <ChevronRight size={12} />
          <span className="truncate font-semibold text-slate-700">
            {current.name}
          </span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          {/* ── Gallery ── */}
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <ProductImage
                url={heroImage}
                alt={current.image_alt_text || current.name}
                slotPx={900}
                aspect="aspect-square"
                priority
              />
              <PackChip spec={spec} />
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {gallery.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setImageIndex(i)}
                    aria-label={`Image ${i + 1}`}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      i === imageIndex ? "border-red-600" : "border-slate-200"
                    }`}
                  >
                    <ProductImage
                      url={url}
                      alt=""
                      slotPx={120}
                      aspect="aspect-square"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Buy panel ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {brand && (
              <div className="text-caption font-semibold uppercase tracking-wide text-slate-400">
                {brand}
              </div>
            )}
            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
              {current.name}
            </h1>
            {current.sku && (
              <div className="mt-1 text-caption text-slate-500">
                SKU {current.sku}
              </div>
            )}

            <div className="mt-4">
              <VariantSelector
                variants={variants}
                selectedId={current.id}
                onSelect={setSelected}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <PriceSlot
                price={current.price}
                spec={spec}
                isAuthenticated={isAuthenticated}
                size="pdp"
              />

              <div className="mt-3">
                <OrderRule spec={spec} />
              </div>

              {isAuthenticated ? (
                <div className="mt-4">
                  <div className="mb-1.5 text-caption font-bold uppercase tracking-wide text-slate-500">
                    Quantity {spec.unit === "pcs" ? "(pcs)" : `(${spec.noun})`}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <QtyStepper
                      packs={packs}
                      spec={spec}
                      size="lg"
                      onChange={next => {
                        // 0 means "below the minimum" here. The PDP has no line
                        // to remove, so hold at the floor instead of dropping to
                        // zero and leaving an un-addable panel.
                        setPacksState(next > 0 ? next : initialPacks(spec));
                      }}
                    />
                    {qtyLabel.secondary && (
                      <span className="text-body-sm font-semibold text-slate-500 tabular-nums">
                        = {qtyLabel.secondary}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={addToCart}
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-red-600 text-body-md font-bold text-white shadow-[0_6px_20px_rgba(220,38,38,0.28)] transition hover:bg-red-700"
                  >
                    Add to Cart
                    {!onEnquiry && ` · ₹${total.toLocaleString("en-IN")}`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => enquire(current)}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-emerald-200 bg-white text-body-md font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <MessageCircle size={16} />
                  Enquire on WhatsApp
                </button>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <MoqChip spec={spec} />
                <DispatchLine line={dispatchLine} />
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-500">
                  <ShieldCheck size={11} /> GST invoice
                </span>
              </div>
            </div>

            {current.description && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-2 font-extrabold text-slate-900">
                  Description
                </h2>
                <p className="whitespace-pre-line text-body-sm leading-relaxed text-slate-600">
                  {current.description}
                </p>
              </div>
            )}

            {/* Hidden ENTIRELY when there is nothing to show — an empty spec
                table reads as missing data, not as a product with no specs. */}
            {hasSpecs && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-2 font-extrabold text-slate-900">
                  Specifications
                </h2>
                <dl>
                  {Object.entries(specs).map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-[140px_1fr] gap-3 border-b border-slate-100 py-2 text-body-sm last:border-0"
                    >
                      <dt className="font-medium capitalize text-slate-500">
                        {k}
                      </dt>
                      <dd className="font-semibold text-slate-900">
                        {String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-extrabold tracking-tight">
              Similar products
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {similar.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Sticky mobile action bar ──
          Sits above the bottom nav (60px) and clears the safe area. The page
          adds matching bottom padding so nothing hides behind it. */}
      <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <QtyStepper
              packs={packs}
              spec={spec}
              onChange={next =>
                setPacksState(next > 0 ? next : initialPacks(spec))
              }
            />
            <button
              onClick={addToCart}
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-red-600 text-body-sm font-bold text-white"
            >
              Add{!onEnquiry && ` · ₹${total.toLocaleString("en-IN")}`}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-sm font-extrabold text-red-600">
                Sign in for rates
              </div>
              <div className="truncate text-[10.5px] text-slate-500">
                {spec.unit === "pcs"
                  ? `Minimum ${spec.minPcs.toLocaleString("en-IN")} pcs`
                  : `Minimum ${spec.minPacks} ${spec.noun}`}
              </div>
            </div>
            <button
              onClick={() => enquire(current)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-emerald-200 px-4 text-body-sm font-bold text-emerald-700"
            >
              <MessageCircle size={14} />
              Enquire
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

// Kept as a local component because ProductDetail renders it from THREE
// branches (loading, not-found, loaded). The chrome around it now comes from
// StorefrontLayout; this is only the <main> and its page-specific padding.
function Shell({ children }: { children: React.ReactNode }) {
  // Bottom padding clears the sticky action bar AND the mobile nav.
  return <main className="flex-1 pb-40 lg:pb-10">{children}</main>;
}
