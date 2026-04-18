/**
 * Server-only. Do NOT import from client components.
 */
import { QueryClient, dehydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";

/** Build a fresh QueryClient for a single server render. */
export function createServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: false,
      },
    },
  });
}

/**
 * Best-effort prefetch: never throws. A single failed prefetch should not
 * break the whole page — the client will retry through its normal hooks.
 */
export async function ssrPrefetch<T>(
  qc: QueryClient,
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>
): Promise<void> {
  try {
    await qc.prefetchQuery({ queryKey, queryFn });
  } catch {
    // swallow — client hook will handle the error path
  }
}

export function dehydrateState(qc: QueryClient): DehydratedState {
  return dehydrate(qc);
}
