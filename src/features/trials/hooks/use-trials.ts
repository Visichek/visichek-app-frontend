"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import { ApiError } from "@/types/api";
import type { TrialClaimResponse } from "@/types/billing";

/**
 * Trial code lifecycle:
 *
 *   - `POST /v1/trials/claim?plan_id=...`  → reserve a code for this
 *     tenant. Idempotent for the same (tenant, plan); switching plans
 *     implicitly cancels the previous pending code and issues a fresh one.
 *
 *   - `GET /v1/trials/me?plan_id=<optional>`  → the tenant's outstanding
 *     pending trial, or `null`.
 *
 *   - `GET /v1/trials/preview?code=...&plan_id=...`  → re-render a held
 *     code across navigation. Read-only.
 *
 * None of these consume the code. Redemption happens server-side when a
 * $0 checkout completes; cancellation releases the code so the tenant can
 * claim again without burning their one-shot entitlement.
 */

const trialKeys = {
  all: ["trials"] as const,
  me: (planId?: string) => ["trials", "me", planId ?? null] as const,
  preview: (code: string, planId: string) =>
    ["trials", "preview", code, planId] as const,
};

/**
 * The tenant's outstanding pending trial code, or `null` if none.
 *
 * Returns `null` (not an error) when the backend has nothing to hand back —
 * the underlying endpoint returns 200 with a nullable body, but we also
 * coerce 404 to `null` defensively.
 */
export function useMyTrial(planId?: string) {
  return useQuery<TrialClaimResponse | null>({
    queryKey: trialKeys.me(planId),
    queryFn: async () => {
      try {
        const data = await apiGet<TrialClaimResponse | null>(
          "/trials/me",
          planId ? { plan_id: planId } : undefined,
        );
        return data ?? null;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

/**
 * Claim a trial code for the calling tenant on the given plan.
 *
 * Errors to surface inline:
 *   - `TRIAL_NOT_SUPPORTED` (400)  → plan.trial_days === 0
 *   - `TRIAL_ALREADY_USED`  (409)  → tenant has already redeemed once
 *   - `VALIDATION_FAILED`   (400)  → plan inactive
 *   - `RESOURCE_NOT_FOUND`  (404)  → no such plan
 */
export function useClaimTrial() {
  const queryClient = useQueryClient();
  return useMutation<TrialClaimResponse, Error, { planId: string }>({
    mutationFn: ({ planId }) =>
      apiPost<TrialClaimResponse>(`/trials/claim?plan_id=${encodeURIComponent(planId)}`),
    onSuccess: (data) => {
      // Refresh both the global "/me" and the per-plan flavour so the UI
      // can show "Resume trial" without a manual refetch.
      queryClient.invalidateQueries({ queryKey: trialKeys.me() });
      queryClient.invalidateQueries({ queryKey: trialKeys.me(data.planId) });
    },
  });
}

/**
 * Re-render the summary for a previously claimed trial code without
 * mutating anything. Useful when the FE has a code stashed (e.g. in the
 * URL or local state) across a navigation.
 */
export function useTrialPreview() {
  return useMutation<
    TrialClaimResponse,
    Error,
    { code: string; planId: string }
  >({
    mutationFn: ({ code, planId }) =>
      apiGet<TrialClaimResponse>("/trials/preview", {
        code,
        plan_id: planId,
      }),
  });
}
