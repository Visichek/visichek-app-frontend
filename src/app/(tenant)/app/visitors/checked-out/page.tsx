import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { VisitorsPageClient } from "../visitors-page-client";
import { checkinKeys } from "@/features/checkins/lib/query-keys";
import { checkinListPath } from "@/features/checkins/lib/endpoints";
import type { CheckinOut } from "@/types/checkin";

export const dynamic = "force-dynamic";

export default async function VisitorsCheckedOutPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    const params = { state: "checked_out" as const };
    await ssrPrefetch(
      qc,
      checkinKeys.list(session.tenantId, params),
      () =>
        serverApiGet<CheckinOut[]>(checkinListPath(session.tenantId), {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
          params,
        }),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <VisitorsPageClient activeState="checked_out" />
    </HydrationBoundary>
  );
}
