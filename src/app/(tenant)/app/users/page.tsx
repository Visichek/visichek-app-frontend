import { getServerTenantSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { UsersPageClient } from "./users-page-client";
import type { SystemUser } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerTenantSession();
  const qc = createServerQueryClient();

  if (session) {
    // Key matches `useSystemUsers()` (filters=undefined) — see
    // src/features/users/hooks/use-users.ts userKeys.list.
    await ssrPrefetch(
      qc,
      ["users", "list", undefined],
      () =>
        serverApiGet<SystemUser[]>("/system-users", {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
        }),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <UsersPageClient />
    </HydrationBoundary>
  );
}
