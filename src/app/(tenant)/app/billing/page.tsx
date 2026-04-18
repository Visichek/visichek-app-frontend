import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { BillingPageClient } from "./billing-page-client";
import type { TenantUsageSummary, Invoice, Subscription, CheckoutSession } from "@/types/billing";

interface InvoicesResponse {
  data: Invoice[];
  meta?: { total?: number; skip?: number; limit?: number };
}

// Opt into dynamic rendering — this page depends on per-request cookies.
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  // Graceful degradation: until the cookie-domain change lands,
  // getServerTenantSession() returns null and prefetch is a no-op.
  // The page still renders — client hooks fetch as they always have.
  if (session) {
    const { accessToken, cookieHeader, tenantId, role } = session;
    const isSuperAdmin = role === "super_admin";

    const fetchOptions = { accessToken, cookieHeader };

    // Prefetch in parallel — query keys MUST match the client hooks or
    // hydration misses and TanStack re-fetches, wasting the SSR work.
    await Promise.all([
      ssrPrefetch(qc, ["usage", "my-usage"], () =>
        serverApiGet<TenantUsageSummary>("/usage/my-usage", fetchOptions)
      ),
      ssrPrefetch(qc, ["invoices", "tenant", tenantId], () =>
        serverApiGet<InvoicesResponse>(
          `/invoices/tenant/${tenantId}`,
          fetchOptions
        )
      ),
      isSuperAdmin
        ? ssrPrefetch(
            qc,
            ["subscriptions", "tenant", tenantId, "active"],
            () =>
              serverApiGet<Subscription>(
                `/subscriptions/tenant/${tenantId}/active`,
                fetchOptions
              )
          )
        : Promise.resolve(),
      isSuperAdmin
        ? ssrPrefetch(
            qc,
            ["checkout", "sessions", "list", { limit: 50 }],
            () =>
              serverApiGet<CheckoutSession[]>("/checkout/sessions", {
                ...fetchOptions,
                params: { limit: 50 },
              })
          )
        : Promise.resolve(),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <BillingPageClient />
    </HydrationBoundary>
  );
}
