"use client";

/**
 * Layout placeholder rendered while the lazy chart body chunk is loading.
 * Matches the height the body will occupy so the surrounding Card does
 * not shift once recharts arrives.
 */
export function ChartBodySkeleton({ height }: { height: number }) {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className="animate-pulse rounded-md bg-muted/40"
      style={{ height }}
    />
  );
}
