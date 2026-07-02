import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Package,
  ImageIcon,
  Plus,
  LayoutGrid,
  Sparkles,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { productService, mediaService } from "@/lib/productService";
import { healthService, MissingCounts } from "@/lib/healthService";
import {
  MISSING_FILTERS,
  ATTENTION_LABELS,
  ATTENTION_FIELD,
} from "@/lib/catalogHealth";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { Product } from "@/lib/supabase";

interface Counts {
  total: number;
  published: number;
  draft: number;
  images: number;
}

// /admin-v2 landing page. Pure read-only composition of existing services:
// product counts via getAllAdmin (count only), missing-data summary via
// healthService → v_product_health (never re-implemented here), image count
// via mediaService, and the 10 most recently updated products.
export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [missing, setMissing] = useState<MissingCounts | null>(null);
  const [recent, setRecent] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Each block is independent — one failing (e.g. storage listing) must
      // not blank the whole dashboard.
      const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await fn();
        } catch {
          return fallback;
        }
      };

      const [total, published, draft, images, missingCounts, recentRes] =
        await Promise.all([
          safe(
            () => productService.getAllAdmin({ page: 1, pageSize: 1 }),
            { data: [], count: 0 }
          ),
          safe(
            () =>
              productService.getAllAdmin({
                page: 1,
                pageSize: 1,
                status: "published",
              }),
            { data: [], count: 0 }
          ),
          safe(
            () =>
              productService.getAllAdmin({
                page: 1,
                pageSize: 1,
                status: "draft",
              }),
            { data: [], count: 0 }
          ),
          safe(() => mediaService.listAllImages(), []),
          safe(() => healthService.getMissingCounts(), null as MissingCounts | null),
          safe(
            () =>
              productService.getAllAdmin({
                page: 1,
                pageSize: 10,
                sortField: "updated_at",
                sortAscending: false,
              }),
            { data: [], count: 0 }
          ),
        ]);

      if (cancelled) return;
      setCounts({
        total: total.count,
        published: published.count,
        draft: draft.count,
        images: images.length,
      });
      setMissing(missingCounts);
      setRecent(recentRes.data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Catalogue at a glance — counts, missing data, and recent edits.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <QuickAction
          to="/admin-v2/products/new"
          icon={<Plus className="w-4 h-4" />}
          label="New Product"
          primary
        />
        <QuickAction
          to="/admin-v2/products"
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Open Grid"
        />
        <QuickAction
          to="/admin-v2/ai"
          icon={<Sparkles className="w-4 h-4 text-amber-500" />}
          label="AI Workspace"
        />
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total products"
          value={counts?.total ?? 0}
          icon={<Package className="w-4 h-4 text-slate-400" />}
        />
        <StatCard
          label="Published"
          value={counts?.published ?? 0}
          accent="text-green-600"
        />
        <StatCard
          label="Draft"
          value={counts?.draft ?? 0}
          accent="text-amber-600"
        />
        <StatCard
          label="Images in library"
          value={counts?.images ?? 0}
          icon={<ImageIcon className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Missing-data summary (v_product_health via healthService) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
          Missing data
        </h2>
        {missing ? (
          <div className="flex flex-wrap gap-2">
            {MISSING_FILTERS.map(f => {
              const count = missing[ATTENTION_FIELD[f]];
              return (
                <Link
                  key={f}
                  to={`/admin-v2/products?missing=${f}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    count > 0
                      ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}
                >
                  {ATTENTION_LABELS[f]}
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-bold ${
                      count > 0
                        ? "bg-amber-200/70 text-amber-900"
                        : "bg-slate-200/70 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Could not load the health summary.
          </p>
        )}
      </div>

      {/* Recent products */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Recently updated
          </h2>
          <Link
            to="/admin-v2/products"
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            No products yet.
          </p>
        ) : (
          recent.map(p => {
            const img = normalizeImageUrl(p.image_url);
            const published = p.status === "published";
            return (
              <Link
                key={p.id}
                to={`/admin-v2/products/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 shrink-0 rounded-md border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {p.name}
                  </p>
                  {p.updated_at && (
                    <p className="text-[11px] text-slate-400">
                      {new Date(p.updated_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    published
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {published ? "Published" : "Draft"}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  label,
  primary = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        primary
          ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = "text-slate-900",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        {icon}
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
