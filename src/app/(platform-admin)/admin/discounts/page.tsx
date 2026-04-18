import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { DiscountsPageClient } from "./discounts-page-client";
import type { Discount } from "@/types/billing";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useDiscounts()` — see
    // src/features/discounts/hooks/use-discounts.ts.
    await ssrPrefetch(qc, ["discounts"], () =>
      serverApiGet<Discount[]>("/discounts", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <DiscountsPageClient />
    </HydrationBoundary>
  );
}
