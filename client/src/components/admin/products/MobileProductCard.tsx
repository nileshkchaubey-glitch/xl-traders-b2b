import { useState } from "react";
import { ImageIcon, ChevronRight, AlertTriangle } from "lucide-react";
import { Product } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { productCompleteness } from "@/lib/catalogHealth";

// Price rendering matches the desktop table exactly: null = "Price on enquiry"
// (NEVER ₹0), 0 = "Free", otherwise the rupee amount.
function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}

interface MobileProductCardProps {
  product: Product;
  categoryName: string;
  onTap: (product: Product) => void;
}

/**
 * Mobile admin product row — a whole-card tap target that opens the quick-edit
 * sheet. Reuses the existing completeness helper for the missing-data badge so
 * it stays in sync with the desktop table's score column.
 */
export default function MobileProductCard({
  product,
  categoryName,
  onTap,
}: MobileProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const img = normalizeImageUrl(product.image_url, 120);
  const { missing } = productCompleteness(product);
  const published = product.status === "published";

  return (
    <button
      onClick={() => onTap(product)}
      className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2.5 text-left active:bg-slate-50 transition min-h-[72px]"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {img && !imgError ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageIcon className="w-5 h-5 text-slate-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate font-semibold text-slate-800 text-[14px]">
            {product.name}
          </span>
          {product.variant_label && (
            <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
              {product.variant_label}
            </span>
          )}
        </div>

        <div className="text-[11.5px] text-slate-400 truncate mt-0.5">
          {product.sku ? `${product.sku} · ` : ""}
          {categoryName}
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[13px] font-bold tabular-nums text-slate-800">
            {product.price == null ? (
              <span className="italic font-medium text-slate-400">
                Price on enquiry
              </span>
            ) : (
              formatPrice(product.price)
            )}
          </span>

          {/* Draft / Published */}
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${
              published
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {published ? "Published" : "Draft"}
          </span>

          {/* Active / inactive */}
          <span
            title={product.is_active ? "Active" : "Inactive"}
            className={`w-1.5 h-1.5 rounded-full ${
              product.is_active ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />

          {/* Missing-data indicator (shared completeness logic) */}
          {missing.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 text-[10px] font-semibold"
              title={`Missing: ${missing.join(", ")}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {missing.length} missing
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
    </button>
  );
}
