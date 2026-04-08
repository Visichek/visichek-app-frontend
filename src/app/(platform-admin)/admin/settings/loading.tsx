export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />

      <div className="flex gap-8">
        {/* Tab sidebar skeleton — desktop only */}
        <div className="hidden md:flex md:flex-col md:w-48 lg:w-52 shrink-0 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-muted"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="flex-1 max-w-2xl space-y-6">
          {/* Section heading */}
          <div className="space-y-2">
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
          </div>
          {/* Rows */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-muted"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
          {/* Second section */}
          <div className="space-y-2 pt-4">
            <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-muted"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
