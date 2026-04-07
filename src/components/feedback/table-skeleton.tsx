import { cn } from "@/lib/utils/cn";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg border", className)}>
      {/* Header */}
      <div className="flex gap-4 border-b bg-muted/50 p-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-4 flex-1 animate-pulse rounded bg-muted"
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 border-b p-4 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 flex-1 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
