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
import type { AdminSearchResult } from "@/types/admin";

export const adminSupportCaseKeys = {
  all: ["admin-support-cases"] as const,
  list: (params?: AdminSupportCaseListParams) =>
    ["admin-support-cases", "list", params ?? {}] as const,
  sla: ["admin-support-cases", "approaching-sla"] as const,
  detail: (id: string) => ["admin-support-cases", "detail", id] as const,
  messages: (id: string) => ["admin-support-cases", "messages", id] as const,
};

export const adminSearchKeys = {
  search: (query: string) => ["admins", "search", query] as const,
};

// ── Queries ───────────────────────────────────────────────────────────

/** Admin list across all tenants. */
export function useAdminSupportCases(params?: AdminSupportCaseListParams) {
  return useQuery<SupportCase[]>({
    queryKey: adminSupportCaseKeys.list(params),
    queryFn: () =>
      apiGet<SupportCase[]>("/admins/support-cases", params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Active cases whose `slaDueAt` falls in the next 24h. Drives the admin
 * dashboard warning ribbon. Auto-refreshes every minute.
 */
export function useApproachingSla() {
  return useQuery<SupportCase[]>({
    queryKey: adminSupportCaseKeys.sla,
    queryFn: () =>
      apiGet<SupportCase[]>("/admins/support-cases/approaching-sla"),
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

/**
 * Admin reply. Supports `internalNote: true` for notes tenants never see.
 *
 * Replies that carry attachments are routed to
 * `/admins/support-cases/{id}/attachments` — `/messages` does not register
 * uploaded object keys on the thread. Plain-text replies keep using
 * `/messages` as before.
 */
export function useAdminReplySupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, SupportCaseMessageRequest>({
    mutationFn: (data) => {
      const hasAttachments = (data.attachments?.length ?? 0) > 0;
      const path = hasAttachments
        ? `/admins/support-cases/${caseId}/attachments`
        : `/admins/support-cases/${caseId}/messages`;
      return apiPost<AsyncJobAck>(path, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.messages(caseId) });
      queryClient.invalidateQueries({ queryKey: adminSupportCaseKeys.all });
    },
  });
}

/**
 * Search application admins by id, email, or name.
 * Only enabled when the trimmed query has at least one character.
 * Results are cached briefly to keep keystroke-driven refetches cheap.
 */
export function useSearchAdmins(query: string) {
  const trimmed = query.trim();
  return useQuery<AdminSearchResult[]>({
    queryKey: adminSearchKeys.search(trimmed),
    queryFn: () =>
      apiGet<AdminSearchResult[]>("/admins/search", {
        q: trimmed,
        start: 0,
        stop: 20,
      }),
    enabled: trimmed.length >= 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
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
