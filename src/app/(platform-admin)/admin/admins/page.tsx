import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { AdminsPageClient } from "./admins-page-client";
import type { Admin } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useAdmins()` in
    // src/features/admins/hooks/use-admins.ts.
    await ssrPrefetch(qc, ["admin-accounts", "list"], () =>
      serverApiGet<Admin[]>("/admins/", {
        accessToken: session.accessToken,
        cookieHeader: session.cookieHeader,
      }),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <AdminsPageClient />
    </HydrationBoundary>
  );
}
