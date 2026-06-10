import { useState, useEffect } from 'react';
import { Package, Grid3x3, MessageSquare, Star, TrendingUp, CheckCircle, XCircle, Clock, ImageOff, IndianRupee, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { AttentionFilter } from '@/lib/catalogHealth';

interface HealthCounts {
  image: number;
  price: number;
  category: number;
  slug: number;
  meta: number;
}

interface Stats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  featuredProducts: number;
  totalCategories: number;
  totalEnquiries: number;
  newEnquiries: number;
  health: HealthCounts;
  recentProducts: Array<{ id: string; name: string; created_at: string; is_active: boolean; category_name: string }>;
}

// Count head-queries are cheap and stay accurate beyond PostgREST's 1000-row
// page cap. slug/meta_title columns may not exist until the SEO migration
// runs — those two queries then error and we fall back to 0.
const countOrZero = (r: { count: number | null; error: any }) => (r.error ? 0 : r.count ?? 0);

async function fetchStats(): Promise<Stats> {
  const [
    { count: totalProducts },
    { count: activeProducts },
    { count: inactiveProducts },
    { count: featuredProducts },
    { count: totalCategories },
    { count: totalEnquiries },
    { count: newEnquiries },
    hasImage,
    hasPrice,
    hasCategory,
    hasSlug,
    hasMeta,
    { data: recentRaw },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', false),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_featured', true),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('products').select('*', { count: 'exact', head: true }).not('image_url', 'is', null).neq('image_url', ''),
    supabase.from('products').select('*', { count: 'exact', head: true }).gt('price', 0),
    supabase.from('products').select('*', { count: 'exact', head: true }).not('category_id', 'is', null),
    supabase.from('products').select('*', { count: 'exact', head: true }).not('slug', 'is', null).neq('slug', ''),
    supabase.from('products').select('*', { count: 'exact', head: true }).not('meta_title', 'is', null).neq('meta_title', ''),
    supabase
      .from('products')
      .select('id, name, created_at, is_active, categories(name)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const recentProducts = (recentRaw ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    is_active: p.is_active,
    category_name: p.categories?.name ?? '',
  }));

  return {
    totalProducts: totalProducts ?? 0,
    activeProducts: activeProducts ?? 0,
    inactiveProducts: inactiveProducts ?? 0,
    featuredProducts: featuredProducts ?? 0,
    totalCategories: totalCategories ?? 0,
    totalEnquiries: totalEnquiries ?? 0,
    newEnquiries: newEnquiries ?? 0,
    health: {
      image: countOrZero(hasImage),
      price: countOrZero(hasPrice),
      category: countOrZero(hasCategory),
      slug: countOrZero(hasSlug),
      meta: countOrZero(hasMeta),
    },
    recentProducts,
  };
}

function healthBarColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function HealthBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-slate-600 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${healthBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right text-xs font-semibold text-slate-700 flex-shrink-0">{pct}% ({count})</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
        <p className="text-sm font-medium text-slate-700 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </Card>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface AdminOverviewProps {
  onTabChange?: (tab: string) => void;
  // Opens the Products tab with a "Needs Attention" filter pre-applied.
  onNeedsAttention?: (filter: Exclude<AttentionFilter, null>) => void;
}

export default function AdminOverview({ onTabChange, onNeedsAttention }: AdminOverviewProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const activePercent = stats.totalProducts
    ? Math.round((stats.activeProducts / stats.totalProducts) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500 text-sm mt-1">XL Traders B2B — real-time catalogue summary</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Total Products"
          value={stats.totalProducts}
          sub={`${activePercent}% active`}
          color="bg-red-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Active"
          value={stats.activeProducts}
          sub="Listed in catalogue"
          color="bg-green-500"
        />
        <StatCard
          icon={XCircle}
          label="Inactive"
          value={stats.inactiveProducts}
          sub="Hidden from buyers"
          color="bg-slate-400"
        />
        <StatCard
          icon={Star}
          label="Featured"
          value={stats.featuredProducts}
          sub="Homepage showcase"
          color="bg-amber-500"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Grid3x3}
          label="Catalogues"
          value={stats.totalCategories}
          sub="Product categories"
          color="bg-blue-500"
        />
        <StatCard
          icon={MessageSquare}
          label="Enquiries"
          value={stats.totalEnquiries}
          sub={`${stats.newEnquiries} new`}
          color="bg-violet-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Catalogue Fill"
          value={`${activePercent}%`}
          sub={`${stats.totalProducts} total products`}
          color="bg-orange-500"
        />
      </div>

      {/* Progress bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-700">Active catalogue coverage</span>
          <span className="text-sm font-bold text-slate-900">{stats.activeProducts} / {stats.totalProducts}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-red-600 h-3 rounded-full transition-all duration-700"
            style={{ width: `${activePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{stats.activeProducts} active</span>
          <span>{stats.inactiveProducts} inactive</span>
        </div>
      </Card>

      {/* Catalogue Health + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Catalogue Health</h3>
          <div className="space-y-3">
            <HealthBar label="Images" count={stats.health.image} total={stats.totalProducts} />
            <HealthBar label="Prices" count={stats.health.price} total={stats.totalProducts} />
            <HealthBar label="Categories" count={stats.health.category} total={stats.totalProducts} />
            <HealthBar label="Slugs" count={stats.health.slug} total={stats.totalProducts} />
            <HealthBar label="SEO" count={stats.health.meta} total={stats.totalProducts} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-1">Needs Attention</h3>
          <p className="text-xs text-slate-400 mb-4">Click to open Products filtered to these items</p>
          <div className="space-y-2">
            {([
              { label: 'Products with no image', icon: ImageOff, count: stats.totalProducts - stats.health.image, filter: 'no-image' as const },
              { label: 'Products with no price', icon: IndianRupee, count: stats.totalProducts - stats.health.price, filter: 'no-price' as const },
              { label: 'Products with no slug', icon: Link2, count: stats.totalProducts - stats.health.slug, filter: 'no-slug' as const },
            ]).map((item) => (
              <button
                key={item.filter}
                onClick={() => onNeedsAttention?.(item.filter)}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <item.icon className="w-4 h-4 text-slate-400" />
                  {item.label}
                </span>
                <span
                  className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                    item.count === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {item.count === 0 ? '✓ all done' : item.count}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Add Product', tab: 'products', color: 'bg-red-600 hover:bg-red-700 text-white' },
            { label: 'Add Catalogue', tab: 'categories', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
            { label: 'Import Products', tab: 'bulk-import', color: 'bg-green-600 hover:bg-green-700 text-white' },
            { label: 'View Enquiries', tab: 'enquiries', color: 'bg-violet-600 hover:bg-violet-700 text-white' },
          ].map((a) => (
            <button
              key={a.tab}
              onClick={() => onTabChange?.(a.tab)}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Products */}
      {stats.recentProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-800">Recently Added</h3>
            <button
              onClick={() => onTabChange?.('products')}
              className="text-xs text-red-600 hover:underline font-medium"
            >
              View all →
            </button>
          </div>
          <Card>
            <div className="divide-y divide-slate-100">
              {stats.recentProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.category_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(p.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
