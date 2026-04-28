// components/ui/EntityListSkeleton.tsx
'use client';

interface EntityListSkeletonProps {
  viewMode: 'grid' | 'list';
  count?: number;
  /** Tailwind grid-cols utility classes (e.g. 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'). */
  gridCols?: string;
  /** Tailwind gap utility (e.g. 'gap-4'). */
  gridGap?: string;
  /** Aspect ratio class for the card preview block. */
  previewAspect?: string;
}

/**
 * Skeleton placeholders for entity list pages while data is loading.
 * Mirrors the dimensions of ProposalListCard / TemplateListCard / DocumentListCard
 * so the layout doesn't jump when real data arrives.
 */
export default function EntityListSkeleton({
  viewMode,
  count = 8,
  gridCols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  gridGap = 'gap-4',
  previewAspect = 'aspect-[16/10]',
}: EntityListSkeletonProps) {
  if (viewMode === 'grid') {
    return (
      <div className={`grid ${gridCols} ${gridGap}`} aria-busy="true" aria-label="Loading">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-[14px] border border-edge flex flex-col overflow-hidden"
          >
            <div className={`w-full ${previewAspect} bg-surface animate-pulse border-b border-edge`} />
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 rounded bg-surface animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-surface animate-pulse" />
              <div className="flex items-center justify-between pt-2">
                <div className="h-5 w-16 rounded-md bg-surface animate-pulse" />
                <div className="h-5 w-20 rounded bg-surface animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-[12px] border border-edge p-3 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-lg bg-surface animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-surface animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-surface animate-pulse" />
          </div>
          <div className="h-5 w-16 rounded-md bg-surface animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  );
}
