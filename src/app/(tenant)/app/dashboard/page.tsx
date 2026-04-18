import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import {
  DashboardPageClient,
  type DashboardStats,
} from "./dashboard-page-client";

export const dynamic = "force-dynamic";

export default async function TenantDashboardPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    await ssrPrefetch(qc, ["tenant", "dashboard", "stats"], () =>
      serverApiGet<DashboardStats>("/dashboard/stats", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <DashboardPageClient />
    </HydrationBoundary>
  );
}
