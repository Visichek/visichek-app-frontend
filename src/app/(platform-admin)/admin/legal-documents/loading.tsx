import { TableSkeleton } from "@/components/feedback/table-skeleton";

export default function LegalDocumentsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
