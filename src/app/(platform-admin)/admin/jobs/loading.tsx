import { TableSkeleton } from "@/components/feedback/table-skeleton";

export default function AdminJobsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
