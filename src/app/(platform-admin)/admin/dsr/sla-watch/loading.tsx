import { TableSkeleton } from "@/components/feedback/table-skeleton";

export default function AdminDSRSlaWatchLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-16 animate-pulse rounded-lg border bg-card" />
      <TableSkeleton rows={5} columns={5} />
      <div className="h-16 animate-pulse rounded-lg border bg-card" />
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
