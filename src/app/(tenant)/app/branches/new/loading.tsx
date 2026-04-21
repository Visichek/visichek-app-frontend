export default function NewBranchLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
