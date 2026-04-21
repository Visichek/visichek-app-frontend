import { TableSkeleton } from "@/components/feedback/table-skeleton";

export default function AdminSlaWatchLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}
