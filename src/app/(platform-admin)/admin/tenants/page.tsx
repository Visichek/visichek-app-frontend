import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { TenantsPageClient } from "./tenants-page-client";
import type { AdminTenant } from "@/types/admin";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useTenantList()` (filters=undefined) — see
    // src/features/auth/hooks/use-admin-dashboard.ts adminKeys.tenantList.
    await ssrPrefetch(
      qc,
      ["admin", "tenants", "list", undefined],
      () =>
        serverApiGet<AdminTenant[]>("/tenants", {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
        })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <TenantsPageClient />
    </HydrationBoundary>
  );
}
