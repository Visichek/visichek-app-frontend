export default function CheckOutVisitorLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-32 animate-pulse rounded-md bg-muted ml-auto" />
    </div>
  );
}
