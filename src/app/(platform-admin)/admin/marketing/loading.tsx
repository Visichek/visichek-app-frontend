export default function MarketingLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted md:max-w-sm" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
