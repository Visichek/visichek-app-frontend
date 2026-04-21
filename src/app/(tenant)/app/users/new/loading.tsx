export default function NewUserLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
