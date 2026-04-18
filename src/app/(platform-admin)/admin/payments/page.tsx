import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { PaymentsPageClient } from "./payments-page-client";
import type { Invoice } from "@/types/billing";

interface InvoicesResponse {
  data: Invoice[];
  meta?: { total?: number; skip?: number; limit?: number };
}

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useAllInvoices()` — see
    // src/features/invoices/hooks/use-invoices.ts.
    await ssrPrefetch(qc, ["invoices", "admin"], () =>
      serverApiGet<InvoicesResponse>("/invoices/admin", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <PaymentsPageClient />
    </HydrationBoundary>
  );
}
