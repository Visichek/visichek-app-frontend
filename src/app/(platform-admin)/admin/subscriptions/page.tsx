import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { SubscriptionsPageClient } from "./subscriptions-page-client";
import type { Subscription } from "@/types/billing";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useSubscriptions()` (params=undefined) — see
    // src/features/subscriptions/hooks/use-subscriptions.ts.
    await ssrPrefetch(qc, ["subscriptions", undefined], () =>
      serverApiGet<Subscription[]>("/subscriptions", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <SubscriptionsPageClient />
    </HydrationBoundary>
  );
}
