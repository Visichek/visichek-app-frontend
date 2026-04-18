import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { VisitorsPageClient } from "./visitors-page-client";
import type { CheckinOut } from "@/types/checkin";

export const dynamic = "force-dynamic";

export default async function VisitorsPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    const { accessToken, cookieHeader, tenantId } = session;
    const params = { state: "pending_approval" as const };

    // Prefetch the default-tab list. Both `useTenantCheckins` callers on the
    // page (active tab + pending-count) use this same key, so one prefetch
    // feeds both. See checkinKeys.list in
    // src/features/checkins/lib/query-keys.ts.
    await ssrPrefetch(
      qc,
      ["checkins", "list", tenantId, params],
      () =>
        serverApiGet<CheckinOut[]>(`/tenants/${tenantId}/checkins`, {
          accessToken,
          cookieHeader,
          params,
        })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <VisitorsPageClient />
    </HydrationBoundary>
  );
}
