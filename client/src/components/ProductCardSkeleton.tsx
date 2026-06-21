// Skeleton placeholder shown while the catalog grid/list is loading. Mirrors the
// real ProductCard layout (aspect-square image + text rows) so the page doesn't
// jump when products arrive, and gives the operator/customer immediate feedback
// instead of a bare "Loading…" line. Pure CSS pulse — no state, no JS cost.
interface ProductCardSkeletonProps {
  view?: 'grid' | 'list';
}

export default function ProductCardSkeleton({ view = 'grid' }: ProductCardSkeletonProps) {
  if (view === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex animate-pulse">
        <div className="w-24 h-24 flex-shrink-0 bg-slate-100" />
        <div className="flex-1 p-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 bg-slate-200 rounded w-3/4" />
            <div className="h-2.5 bg-slate-100 rounded w-1/3" />
          </div>
          <div className="flex-shrink-0 space-y-2">
            <div className="h-3.5 bg-slate-200 rounded w-16" />
            <div className="h-6 bg-slate-100 rounded w-20" />
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden h-full flex flex-col animate-pulse">
      <div className="aspect-square bg-slate-100" />
      <div className="p-2 flex-1 flex flex-col space-y-2">
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/3 mt-1" />
        <div className="h-7 bg-slate-100 rounded w-full mt-auto" />
      </div>
    </div>
  );
}
