import { cn } from "@/lib/utils/cn";

interface PageSkeletonProps {
  className?: string;
}

export function PageSkeleton({ className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border bg-card"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="h-64 animate-pulse rounded-lg border bg-card" />
    </div>
  );
}
