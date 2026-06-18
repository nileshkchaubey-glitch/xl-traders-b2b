/**
 * Loading placeholder that mirrors <ProductCard>'s grid and list layouts so the
 * catalog reserves the right amount of space while products load. Matching the
 * real card dimensions avoids layout shift (the grid doesn't jump when data
 * arrives) and gives the page a faster, more polished feel than a centered
 * "Loading…" line. Pure CSS (`animate-pulse`) — no state, no JS work.
 */
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
            <div className="h-3.5 bg-slate-200 rounded w-16 ml-auto" />
            <div className="h-6 bg-slate-100 rounded w-20" />
          </div>
        </div>
      </div>
    );
  }

  // Grid view — mirrors the aspect-square image + compact body of ProductCard.
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden h-full flex flex-col animate-pulse">
      <div className="aspect-square bg-slate-100" />
      <div className="p-2 flex-1 flex flex-col space-y-2">
        <div className="h-2 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/3 mt-auto" />
        <div className="h-6 bg-slate-100 rounded w-full" />
      </div>
    </div>
  );
}
