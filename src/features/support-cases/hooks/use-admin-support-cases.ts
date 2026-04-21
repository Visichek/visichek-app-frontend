"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  SupportCase,
  SupportCaseDetail,
  SupportCaseMessage,
  SupportCaseMessageRequest,
  SupportCaseTransitionRequest,
  AssignAdminRequest,
  AsyncJobAck,
  AdminSupportCaseListParams,
} from "@/types/support-case";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

export const adminSupportCaseKeys = {
  all: ["admin-support-cases"] as const,
  list: (params?: AdminSupportCaseListParams) =>
    ["admin-support-cases", "list", params ?? {}] as const,
  sla: ["admin-support-cases", "approaching-sla"] as const,
  detail: (id: string) => ["admin-support-cases", "detail", id] as const,
  messages: (id: string) => ["admin-support-cases", "messages", id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────

/** Admin list across all tenants. */
export function useAdminSupportCases(params?: AdminSupportCaseListParams) {
  return useQuery<PaginatedResponse<SupportCase>>({
    queryKey: adminSupportCaseKeys.list(params),
    queryFn: () =>
      apiGet<PaginatedResponse<SupportCase>>(
        "/admins/support-cases",
        params,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Active cases whose `slaDueAt` falls in the next 24h. Drives the admin
 * dashboard warning ribbon. Auto-refreshes every minute.
 */
export function useApproachingSla() {
  return useQuery<PaginatedResponse<SupportCase>>({
    queryKey: adminSupportCaseKeys.sla,
    queryFn: () =>
      apiGet<PaginatedResponse<SupportCase>>(
        "/admins/support-cases/approaching-sla",
      ),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/** Admin detail view — includes internal notes. */
export function useAdminSupportCase(caseId: string) {
  return useQuery<SupportCaseDetail>({
    queryKey: adminSupportCaseKeys.detail(caseId),
    queryFn: () =>
      apiGet<SupportCaseDetail>(`/admins/support-cases/${caseId}`),
    enabled: !!caseId,
  });
}

/** Admin message thread — includes internal notes. */
export function useAdminSupportCaseMessages(caseId: string, enabled = true) {
  return useQuery<SupportCaseMessage[]>({
    queryKey: adminSupportCaseKeys.messages(caseId),
    queryFn: () =>
      apiGet<SupportCaseMessage[]>(
        `/admins/support-cases/${caseId}/messages`,
      ),
    enabled: !!caseId && enabled,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────

/** Admin reply. Supports `internalNote: true` for notes tenants never see. */
export function useAdminReplySupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, SupportCaseMessageRequest>({
    mutationFn: (data) =>
      apiPost<AsyncJobAck>(`/admins/support-cases/${caseId}/messages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.messages(caseId) });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.all });
    },
  });
}

/** Assign an admin to the case. */
export function useAssignAdmin(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, AssignAdminRequest>({
    mutationFn: (data) =>
      apiPost<AsyncJobAck>(`/admins/support-cases/${caseId}/assign`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.all });
    },
  });
}

/** Admin state-machine transition (acknowledge / progress / resolve / etc). */
export function useAdminTransition(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, SupportCaseTransitionRequest>({
    mutationFn: (data) =>
      apiPost<AsyncJobAck>(
        `/admins/support-cases/${caseId}/transition`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.sla });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.all });
    },
  });
}
