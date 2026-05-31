export default function AdminSupportCaseDetailLoading() {
  return (
    <div className="space-y-4">
      <div className="h-11 w-32 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <div className="space-y-3">
          <div className="mr-auto h-16 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="ml-auto h-20 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="mr-auto h-16 w-2/3 animate-pulse rounded-lg bg-muted" />
          <div className="ml-auto h-12 w-1/2 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="mt-4 h-72 animate-pulse rounded-lg bg-muted lg:mt-0" />
      </div>
    </div>
  );
}
