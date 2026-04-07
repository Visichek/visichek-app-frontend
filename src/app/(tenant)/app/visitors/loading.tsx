import { TableSkeleton } from "@/components/feedback/table-skeleton";

export default function VisitorsLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table skeleton */}
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
