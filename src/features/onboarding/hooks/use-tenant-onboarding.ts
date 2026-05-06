"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  OnboardingCompleteRequest,
  OnboardingPendingFields,
} from "@/types/onboarding";

export const tenantOnboardingKeys = {
  all: ["tenant", "onboarding"] as const,
  pendingFields: ["tenant", "onboarding", "pending-fields"] as const,
};

/**
 * `GET /v1/onboarding/me/pending-fields` — returns the field keys + frozen
 * labels the freshly provisioned super_admin still owes after a partial
 * acceptance. The endpoint is exempt from plan enforcement so it works
 * even before the tenant has paid.
 *
 * Returns `null` (via 404 / 409 thrown error) when there are no pending
 * fields — callers should treat the error as "nothing to complete".
 */
export function usePendingOnboardingFields(enabled: boolean = true) {
  return useQuery<OnboardingPendingFields>({
    queryKey: tenantOnboardingKeys.pendingFields,
    queryFn: () =>
      apiGet<OnboardingPendingFields>("/onboarding/me/pending-fields"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * `POST /v1/onboarding/me/complete` — submits values for the pending field
 * keys. The submitted keys must exactly match `pendingFieldKeys`; the
 * service merges them into the original `payload` and flips the submission
 * to `completed`.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    OnboardingPendingFields,
    Error,
    OnboardingCompleteRequest
  >({
    mutationFn: (data) =>
      apiPost<OnboardingPendingFields>("/onboarding/me/complete", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantOnboardingKeys.all });
    },
  });
}
