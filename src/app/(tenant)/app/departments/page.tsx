import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { DepartmentsPageClient } from "./departments-page-client";
import type { Department } from "@/types/tenant";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useDepartments()` (filters=undefined) — see
    // src/features/departments/hooks/use-departments.ts departmentKeys.list.
    await ssrPrefetch(
      qc,
      ["departments", "list", undefined],
      () =>
        serverApiGet<Array<Department & { id?: string }>>("/departments", {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
        }).then((rows) =>
          rows.map((d) => ({ ...d, id: d.id ?? "" })) as Department[],
        ),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <DepartmentsPageClient />
    </HydrationBoundary>
  );
}
