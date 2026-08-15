import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { Product } from "@/lib/supabase";
import {
  productService,
  type PublicProductSort,
} from "@/lib/productService";
import ProductCard from "@/components/ProductCard";
import SectionEyebrow from "@/components/SectionEyebrow";
import { Skeleton } from "@/components/ui/skeleton";

interface MerchandisedRowProps {
  eyebrow: string;
  title: string;
  sort?: PublicProductSort;
  featured?: boolean;
  href: string;
  /** First row on the page loads its images eagerly. */
  priority?: boolean;
}

/**
 * A merchandised product row.
 *
 * Reuses `ProductCard` wholesale — the price gate, guest parity, MOQ chip,
 * pack chip, stepper and dispatch line all come along, so a row can never
 * disagree with the catalogue about how a product is presented.
 *
 * Fetches ONE page through the same paginated `productService.getAll` the
 * catalogue uses. This is a taster, not a second catalogue: it always ends in
 * a link into `/catalog` rather than growing its own pagination.
 *
 * Renders nothing when the query comes back empty, so an under-populated
 * catalogue produces a shorter page rather than an empty shelf.
 */
export default function MerchandisedRow({
  eyebrow,
  title,
  sort = "newest",
  featured,
  href,
  priority = false,
}: MerchandisedRowProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    productService
      .getAll({ pageSize: 8, sort, featured })
      .then(p => !cancelled && setProducts(p))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sort, featured]);

  if (!loading && products.length === 0) return null;

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="flex-shrink-0 text-body-sm font-bold"
          style={{ color: "var(--xl-accent)" }}
        >
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-[52px] w-full" />
                </div>
              </div>
            ))
          : products
              .slice(0, 8)
              .map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  priority={priority && i < 4}
                />
              ))}
      </div>
    </section>
  );
}
