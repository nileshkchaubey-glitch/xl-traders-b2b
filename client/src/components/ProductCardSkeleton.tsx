import { Skeleton } from '@/components/ui/skeleton';

interface ProductCardSkeletonProps {
  view?: 'grid' | 'list';
}

// Placeholder shown while products load. Mirrors ProductCard's layout so the
// real cards slot into the same footprint with no layout shift — the grid keeps
// its shape and the content fades in rather than popping in over plain text.
export default function ProductCardSkeleton({ view = 'grid' }: ProductCardSkeletonProps) {
  if (view === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex">
        <Skeleton className="w-24 h-24 flex-shrink-0 rounded-none" />
        <div className="flex-1 p-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex-shrink-0 space-y-2">
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </div>
    );
  }

  // Grid view — matches the aspect-square image + content stack of ProductCard.
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden h-full flex flex-col">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-2 flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-4 w-16 mt-1" />
        <Skeleton className="h-6 w-full mt-auto" />
      </div>
    </div>
  );
}
