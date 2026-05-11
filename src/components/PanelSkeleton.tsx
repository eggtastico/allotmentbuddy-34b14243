import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton shown while lazy-loaded modal panels are being fetched.
 * Mimics the typical Dialog layout: header bar + content lines.
 */
export function PanelSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl shadow-lg w-full max-w-lg mx-4 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>

        {/* Content lines */}
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>

        {/* Action area */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}
