import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { MarketingPageClient } from "./marketing-page-client";
import { adminOnboardingKeys } from "@/features/onboarding/hooks";
import type { MarketingOptInExport } from "@/types/onboarding";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    await ssrPrefetch(qc, adminOnboardingKeys.marketingOptIns, () =>
      serverApiGet<MarketingOptInExport>(
        "/tenants/onboarding/marketing-opt-ins",
        {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
        },
      ),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <MarketingPageClient />
    </HydrationBoundary>
  );
}
