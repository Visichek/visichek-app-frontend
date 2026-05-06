import { getServerAdminSession } from "@/lib/auth/server-session";
import { serverApiGet } from "@/lib/api/server-client";
import {
  createServerQueryClient,
  dehydrateState,
  ssrPrefetch,
} from "@/lib/api/server-prefetch";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { OnboardingQueueClient } from "./onboarding-queue-client";
import type { OnboardingSubmission } from "@/types/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingQueuePage() {
  const session = await getServerAdminSession();
  const qc = createServerQueryClient();

  if (session) {
    // Default queue view: status=new, no skip/limit. Key shape mirrors
    // adminOnboardingKeys.list({ status: "new" }) so the client cache hydrates.
    await ssrPrefetch(
      qc,
      ["admin", "onboarding", "list", { status: "new" }],
      () =>
        serverApiGet<OnboardingSubmission[]>("/tenants/onboarding", {
          accessToken: session.accessToken,
          cookieHeader: session.cookieHeader,
          params: { status: "new" },
        }),
    );
  }

  return (
    <HydrationBoundary state={dehydrateState(qc)}>
      <OnboardingQueueClient />
    </HydrationBoundary>
  );
}
