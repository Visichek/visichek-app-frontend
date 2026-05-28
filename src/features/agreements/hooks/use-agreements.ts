"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import { tenantOnboardingKeys } from "@/features/onboarding/hooks";
import type {
  AgreementKey,
  DeclineAgreementResult,
  PendingAgreements,
  TenantAgreement,
} from "@/types/agreements";

export const agreementKeys = {
  all: ["agreements"] as const,
  list: ["agreements", "list"] as const,
  pending: ["agreements", "pending"] as const,
  detail: (key: AgreementKey) => ["agreements", "detail", key] as const,
};

/**
 * `GET /v1/agreements` — every platform agreement with this tenant's resolved
 * copy + acceptance state. Any tenant-role token may read.
 */
export function useAgreements(enabled: boolean = true) {
  return useQuery<TenantAgreement[]>({
    queryKey: agreementKeys.list,
    queryFn: () => apiGet<TenantAgreement[]>("/agreements"),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * `GET /v1/agreements/pending` — which keys the tenant still owes. Drives the
 * acceptance banner/prompt. Reachable even while the tenant is blocked, so it
 * is safe to call on every shell mount.
 */
export function usePendingAgreements(enabled: boolean = true) {
  return useQuery<PendingAgreements>({
    queryKey: agreementKeys.pending,
    queryFn: () => apiGet<PendingAgreements>("/agreements/pending"),
    enabled,
    // The gate is re-evaluated server-side every ~2 min after a master is
    // republished; keep this fresh enough to catch a forced re-acceptance.
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * `GET /v1/agreements/{key}` — one resolved agreement with its substituted
 * BlockNote body. `404` when the key is unknown or the master isn't configured
 * yet.
 */
export function useAgreement(key: AgreementKey, enabled: boolean = true) {
  return useQuery<TenantAgreement>({
    queryKey: agreementKeys.detail(key),
    queryFn: () => apiGet<TenantAgreement>(`/agreements/${key}`),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * `POST /v1/agreements/{key}/accept` (super_admin) — freezes the resolved copy
 * as the immutable record and clears the gate within the same response
 * (synchronous, not queued). We invalidate the agreement queries, the pending
 * list, and the onboarding DPA cache (the DPA is mirrored there).
 */
export function useAcceptAgreement() {
  const queryClient = useQueryClient();

  return useMutation<TenantAgreement, Error, AgreementKey>({
    mutationFn: (key) => apiPost<TenantAgreement>(`/agreements/${key}/accept`),
    onSuccess: (data) => {
      queryClient.setQueryData(agreementKeys.detail(data.agreementKey), data);
      queryClient.invalidateQueries({ queryKey: agreementKeys.all });
      // Accepting the DPA here also clears the first-login onboarding gate.
      queryClient.invalidateQueries({ queryKey: tenantOnboardingKeys.all });
    },
  });
}

/**
 * `POST /v1/agreements/{key}/decline` (super_admin) — records the decline; the
 * tenant stays blocked (nothing is deleted).
 */
export function useDeclineAgreement() {
  const queryClient = useQueryClient();

  return useMutation<DeclineAgreementResult, Error, AgreementKey>({
    mutationFn: (key) =>
      apiPost<DeclineAgreementResult>(`/agreements/${key}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agreementKeys.all });
    },
  });
}
