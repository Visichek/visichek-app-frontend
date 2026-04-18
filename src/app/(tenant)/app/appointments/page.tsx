import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { AppointmentsPageClient } from "./appointments-page-client";
import type { Appointment } from "@/types/visitor";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key MUST match `useAppointments()` (filters=undefined) — see
    // src/features/appointments/hooks/use-appointments.ts.
    await ssrPrefetch(qc, ["appointments", "list", undefined], () =>
      serverApiGet<Appointment[]>("/appointments", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      })
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <AppointmentsPageClient />
    </HydrationBoundary>
  );
}
