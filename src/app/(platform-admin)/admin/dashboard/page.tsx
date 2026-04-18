import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import {
  AdminDashboardPageClient,
  type AdminDashboardStats,
} from "./dashboard-page-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    await ssrPrefetch(qc, ["admin", "dashboard", "stats"], () =>
      serverApiGet<AdminDashboardStats>("/admins/dashboard/stats", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <AdminDashboardPageClient />
    </HydrationBoundary>
  );
}
