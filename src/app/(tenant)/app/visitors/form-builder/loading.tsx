export default function FormBuilderLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
