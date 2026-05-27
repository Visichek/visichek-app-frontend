"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  OnboardingCompleteRequest,
  OnboardingPendingFields,
  TenantConfirmation,
  TenantConfirmationRequest,
  TenantDpa,
} from "@/types/onboarding";

export const tenantOnboardingKeys = {
  all: ["tenant", "onboarding"] as const,
  pendingFields: ["tenant", "onboarding", "pending-fields"] as const,
  confirmation: ["tenant", "onboarding", "confirmation"] as const,
  dpa: ["tenant", "onboarding", "dpa"] as const,
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

/**
 * `GET /v1/onboarding/me/tenant-confirmation` (super_admin only) — the
 * first-login "review your company identity" payload. Drives the soft
 * confirmation gate off `onboardingInfoConfirmed`.
 *
 * `403` here means the caller is not a super_admin and `404` means the
 * tenant is missing (rare) — both surface as a thrown error, so callers
 * should treat an error as "don't block / hide the screen" rather than a
 * hard failure.
 */
export function useTenantConfirmation(enabled: boolean = true) {
  return useQuery<TenantConfirmation>({
    queryKey: tenantOnboardingKeys.confirmation,
    queryFn: () =>
      apiGet<TenantConfirmation>("/onboarding/me/tenant-confirmation"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * `GET /v1/onboarding/me/dpa` (super_admin only) — the calling tenant's Data
 * Processing Agreement. While unaccepted, the body is rebuilt from the
 * tenant's current details on each read; once accepted it returns the frozen
 * snapshot.
 *
 * `404` (`RESOURCE_NOT_FOUND`) means the DPA template is not yet configured on
 * the environment — callers should treat the thrown error as "DPA not
 * available yet" and fall back to the external link, not surface it harshly.
 */
export function useTenantDpa(enabled: boolean = true) {
  return useQuery<TenantDpa>({
    queryKey: tenantOnboardingKeys.dpa,
    queryFn: () => apiGet<TenantDpa>("/onboarding/me/dpa"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * `POST /v1/onboarding/me/tenant-confirmation` — confirm (and optionally
 * correct) the tenant's company identity. Every field is optional and an
 * empty body acknowledges the details as-is. Edits apply synchronously
 * (no async job) and the response is the refreshed payload with
 * `onboardingInfoConfirmed = true`.
 *
 * We prime the confirmation cache with the response so the shell gate sees
 * the confirmed flag immediately — without it, navigating to the dashboard
 * could race the cache invalidation and bounce the user back to this screen.
 */
export function useConfirmTenantInfo() {
  const queryClient = useQueryClient();

  return useMutation<
    TenantConfirmation,
    Error,
    TenantConfirmationRequest
  >({
    mutationFn: (data) =>
      apiPost<TenantConfirmation>("/onboarding/me/tenant-confirmation", data),
    onSuccess: (data) => {
      queryClient.setQueryData(tenantOnboardingKeys.confirmation, data);
      // Company identity also lives on the tenant record / tenant-settings.
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
}
