import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { PaymentsPageClient } from "./payments-page-client";
import type { InvoiceWithSummary } from "@/features/invoices/hooks/use-invoices";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Prefetch the unfiltered first page — matches `useAllInvoices()`'s
    // default query key in src/features/invoices/hooks/use-invoices.ts.
    // The server envelope parser already unwraps `.data`, so the cached
    // payload is the flat InvoiceWithSummary[] the client hook expects.
    await ssrPrefetch(
      qc,
      ["invoices", "admin", { start: 0, stop: 50 }],
      () =>
        serverApiGet<InvoiceWithSummary[]>("/invoices/admin", {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
          params: { start: 0, stop: 50 },
        })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <PaymentsPageClient />
    </HydrationBoundary>
  );
}
