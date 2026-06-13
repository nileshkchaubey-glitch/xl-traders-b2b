import { useState, useEffect } from 'react';
import {
  Package, Grid3x3, MessageSquare, Star, CheckCircle, XCircle, Clock,
  ImageOff, IndianRupee, Link2, ArrowRight, Zap, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AttentionFilter } from '@/lib/catalogHealth';
import AdminDailyImprovementsWidget from './AdminDailyImprovementsWidget';


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
  recentProducts: Array<{ id: string; name: string; created_at: string; is_active: boolean; category_name: string; image_url?: string }>;
}

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
    hasImage, hasPrice, hasCategory, hasSlug, hasMeta,
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
    supabase.from('products').select('id,name,created_at,is_active,image_url,categories(name)').order('created_at', { ascending: false }).limit(6),
  ]);

  const recentProducts = (recentRaw ?? []).map((p: any) => ({
    id: p.id, name: p.name, created_at: p.created_at,
    is_active: p.is_active, image_url: p.image_url ?? null,
    category_name: p.categories?.name ?? '',
  }));

  return {
    totalProducts: totalProducts ?? 0, activeProducts: activeProducts ?? 0,
    inactiveProducts: inactiveProducts ?? 0, featuredProducts: featuredProducts ?? 0,
    totalCategories: totalCategories ?? 0, totalEnquiries: totalEnquiries ?? 0,
    newEnquiries: newEnquiries ?? 0,
    health: {
      image: countOrZero(hasImage), price: countOrZero(hasPrice),
      category: countOrZero(hasCategory), slug: countOrZero(hasSlug), meta: countOrZero(hasMeta),
    },
    recentProducts,
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function healthColor(pct: number) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (pct >= 50) return { bar: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' };
  return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' };
}

function catalogueScore(health: HealthCounts, total: number): number {
  if (!total) return 0;
  const weights = [health.image, health.price, health.category, health.slug, health.meta];
  return Math.round(weights.reduce((a, b) => a + b, 0) / (weights.length * total) * 100);
}

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  onClick?: () => void;
}

function KpiCard({ label, value, sub, icon: Icon, accent, onClick }: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : 'cursor-default'} w-full`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-sm font-medium text-slate-600 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </button>
  );
}

function HealthRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const c = healthColor(pct);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-20 text-sm text-slate-600 flex-shrink-0 font-medium">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${c.text}`}>{pct}%</span>
      <span className="text-xs text-slate-400 w-14 text-right flex-shrink-0">{count}/{total}</span>
    </div>
  );
}

interface AdminOverviewProps {
  onTabChange?: (tab: string) => void;
  onNeedsAttention?: (filter: Exclude<AttentionFilter, null>) => void;
}

export default function AdminOverview({ onTabChange, onNeedsAttention }: AdminOverviewProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const activePercent = stats.totalProducts ? Math.round((stats.activeProducts / stats.totalProducts) * 100) : 0;
  const score = catalogueScore(stats.health, stats.totalProducts);
  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500';

  const attentionItems = [
    { label: 'No image', icon: ImageOff, count: stats.totalProducts - stats.health.image, filter: 'no-image' as const, color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { label: 'No price', icon: IndianRupee, count: stats.totalProducts - stats.health.price, filter: 'no-price' as const, color: 'text-red-600 bg-red-50 border-red-200' },
    { label: 'No URL slug', icon: Link2, count: stats.totalProducts - stats.health.slug, filter: 'no-slug' as const, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ];

  const totalIssues = attentionItems.reduce((a, i) => a + i.count, 0);

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">XL Traders B2B — catalogue summary</p>
      </div>

      {/* Daily Admin Improvements PM Widget */}
      <AdminDailyImprovementsWidget />

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={Package} label="Total Products" value={stats.totalProducts}
          sub={`${activePercent}% live`} accent="bg-slate-700" onClick={() => onTabChange?.('products')} />
        <KpiCard icon={CheckCircle} label="Active" value={stats.activeProducts}
          sub="Live in catalogue" accent="bg-emerald-500" onClick={() => onTabChange?.('products')} />
        <KpiCard icon={XCircle} label="Inactive" value={stats.inactiveProducts}
          sub="Hidden from buyers" accent="bg-slate-400" />
        <KpiCard icon={Star} label="Featured" value={stats.featuredProducts}
          sub="Homepage showcase" accent="bg-amber-500" />
        <KpiCard icon={MessageSquare} label="Enquiries" value={stats.totalEnquiries}
          sub={stats.newEnquiries > 0 ? `${stats.newEnquiries} new` : 'All handled'} accent="bg-violet-500"
          onClick={() => onTabChange?.('enquiries')} />
      </div>

      {/* Mid row: Catalogue Score + Health + Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Catalogue Score */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Catalogue Score</p>
          <div className="relative w-28 h-28 mb-4">
            <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${scoreColor}`}>{score}</span>
              <span className="text-xs text-slate-400 font-semibold">/ 100</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {score >= 80 ? '🟢 Excellent' : score >= 60 ? '🟡 Good' : score >= 40 ? '🟠 Needs work' : '🔴 Incomplete'}
          </p>
          <p className="text-xs text-slate-400 mt-1">{stats.totalCategories} categories · {stats.totalProducts} products</p>
        </div>

        {/* Health bars */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Data Completeness</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            <HealthRow label="Images"    count={stats.health.image}    total={stats.totalProducts} />
            <HealthRow label="Prices"    count={stats.health.price}    total={stats.totalProducts} />
            <HealthRow label="Category"  count={stats.health.category} total={stats.totalProducts} />
            <HealthRow label="URL Slug"  count={stats.health.slug}     total={stats.totalProducts} />
            <HealthRow label="SEO Meta"  count={stats.health.meta}     total={stats.totalProducts} />
          </div>
        </div>

        {/* Needs Attention */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className={`w-4 h-4 ${totalIssues > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            <h3 className="text-sm font-bold text-slate-800">Needs Attention</h3>
            {totalIssues > 0 && (
              <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {totalIssues}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <button
                key={item.filter}
                onClick={() => item.count > 0 && onNeedsAttention?.(item.filter)}
                disabled={item.count === 0}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all
                  ${item.count === 0
                    ? 'bg-slate-50 border-slate-100 cursor-default'
                    : `${item.color} hover:shadow-sm hover:-translate-y-0.5 cursor-pointer`
                  }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </span>
                {item.count === 0 ? (
                  <span className="text-xs text-emerald-600 font-bold">✓ All done</span>
                ) : (
                  <span className="flex items-center gap-1 font-bold text-xs">
                    {item.count} <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Add Product', tab: 'products', bg: 'bg-slate-800 hover:bg-slate-700 text-white' },
                { label: 'Import CSV', tab: 'bulk-import', bg: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
                { label: 'Enquiries', tab: 'enquiries', bg: 'bg-violet-600 hover:bg-violet-700 text-white' },
                { label: 'Add Category', tab: 'categories', bg: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
              ].map((a) => (
                <button
                  key={a.tab}
                  onClick={() => onTabChange?.(a.tab)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${a.bg}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recently added */}
      {stats.recentProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">Recently Added</h3>
            </div>
            <button
              onClick={() => onTabChange?.('products')}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate leading-none">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.category_name}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.is_active ? 'Active' : 'Draft'}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(p.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
