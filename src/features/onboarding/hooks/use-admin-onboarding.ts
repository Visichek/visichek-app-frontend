"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  AcceptOnboardingRequest,
  AcceptOnboardingResponse,
  OnboardingListParams,
  OnboardingSubmission,
  PartialAcceptOnboardingRequest,
  RejectOnboardingRequest,
} from "@/types/onboarding";

/**
 * Query key factory for the admin onboarding queue. Mirrors the layout
 * used by adminKeys in use-admin-dashboard.ts so SSR prefetch + client
 * hydration line up exactly.
 */
export const adminOnboardingKeys = {
  all: ["admin", "onboarding"] as const,
  list: (params?: OnboardingListParams) =>
    ["admin", "onboarding", "list", params ?? {}] as const,
  detail: (id: string) => ["admin", "onboarding", "detail", id] as const,
};

/**
 * `GET /v1/tenants/onboarding` — lists self-onboarding submissions for the
 * platform admin queue. Defaults to `status=new` so unread leads sit at the
 * top; passing `undefined` returns the full mixed-status list.
 */
export function useOnboardingSubmissions(params?: OnboardingListParams) {
  return useQuery<OnboardingSubmission[]>({
    queryKey: adminOnboardingKeys.list(params),
    queryFn: () =>
      apiGet<OnboardingSubmission[]>("/tenants/onboarding", params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * `GET /v1/tenants/onboarding/{id}` — single submission with its frozen
 * payload, labels, order, and any reviewer metadata.
 */
export function useOnboardingSubmission(submissionId: string) {
  return useQuery<OnboardingSubmission>({
    queryKey: adminOnboardingKeys.detail(submissionId),
    queryFn: () =>
      apiGet<OnboardingSubmission>(`/tenants/onboarding/${submissionId}`),
    enabled: !!submissionId,
  });
}

function invalidateOnboarding(
  queryClient: ReturnType<typeof useQueryClient>,
  submissionId?: string,
) {
  queryClient.invalidateQueries({ queryKey: adminOnboardingKeys.all });
  // The accept paths provision a new tenant + super admin, so the tenants
  // list and detail caches must drop their stale rows too.
  queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
  if (submissionId) {
    queryClient.invalidateQueries({
      queryKey: adminOnboardingKeys.detail(submissionId),
    });
  }
}

/**
 * `POST /v1/tenants/onboarding/{id}/accept` — provisions tenant + first
 * super admin in one call. The body's `companyName` / `adminFullName` /
 * `adminEmail` are optional overrides; when omitted the service falls back
 * to the submission's extracted fields.
 */
export function useAcceptOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    AcceptOnboardingResponse,
    Error,
    { submissionId: string; data: AcceptOnboardingRequest }
  >({
    mutationFn: ({ submissionId, data }) =>
      apiPost<AcceptOnboardingResponse>(
        `/tenants/onboarding/${submissionId}/accept`,
        data,
      ),
    onSuccess: (_, variables) =>
      invalidateOnboarding(queryClient, variables.submissionId),
  });
}

/**
 * `POST /v1/tenants/onboarding/{id}/partial-accept` — same as accept but
 * also records `pendingFieldKeys` so the new super_admin can fill them in
 * after first login.
 */
export function usePartialAcceptOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    AcceptOnboardingResponse,
    Error,
    { submissionId: string; data: PartialAcceptOnboardingRequest }
  >({
    mutationFn: ({ submissionId, data }) =>
      apiPost<AcceptOnboardingResponse>(
        `/tenants/onboarding/${submissionId}/partial-accept`,
        data,
      ),
    onSuccess: (_, variables) =>
      invalidateOnboarding(queryClient, variables.submissionId),
  });
}

/**
 * `POST /v1/tenants/onboarding/{id}/reject` — declines a submission with
 * reviewer notes that get piped into the rejection email template.
 */
export function useRejectOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    OnboardingSubmission,
    Error,
    { submissionId: string; data: RejectOnboardingRequest }
  >({
    mutationFn: ({ submissionId, data }) =>
      apiPost<OnboardingSubmission>(
        `/tenants/onboarding/${submissionId}/reject`,
        data,
      ),
    onSuccess: (_, variables) =>
      invalidateOnboarding(queryClient, variables.submissionId),
  });
}

/**
 * `POST /v1/tenants/onboarding/{id}/archive` — hides spam/duplicates from
 * the default queue without provisioning anything.
 */
export function useArchiveOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<OnboardingSubmission, Error, string>({
    mutationFn: (submissionId) =>
      apiPost<OnboardingSubmission>(
        `/tenants/onboarding/${submissionId}/archive`,
      ),
    onSuccess: (_, submissionId) =>
      invalidateOnboarding(queryClient, submissionId),
  });
}
