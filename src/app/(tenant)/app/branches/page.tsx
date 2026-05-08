import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { BranchesPageClient } from "./branches-page-client";
import type { Branch } from "@/types/tenant";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useBranches()` (filters=undefined) — see
    // src/features/branches/hooks/use-branches.ts branchKeys.list.
    await ssrPrefetch(
      qc,
      ["branches", "list", undefined],
      () =>
        serverApiGet<Branch[]>("/branches", {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
        }),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <BranchesPageClient />
    </HydrationBoundary>
  );
}
