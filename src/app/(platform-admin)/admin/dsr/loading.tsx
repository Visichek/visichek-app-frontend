import { TableSkeleton } from "@/components/feedback/table-skeleton";

export default function AdminDSRLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
