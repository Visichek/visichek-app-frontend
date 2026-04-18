import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { PlansPageClient } from "./plans-page-client";
import type { Plan } from "@/types/billing";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    const params = { skip: 0, limit: 50 };
    // Key matches `usePlans({ skip: 0, limit: 50 })` — see
    // src/features/plans/hooks/use-plans.ts.
    await ssrPrefetch(qc, ["plans", params], () =>
      serverApiGet<Plan[]>("/plans", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
        params,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <PlansPageClient />
    </HydrationBoundary>
  );
}
