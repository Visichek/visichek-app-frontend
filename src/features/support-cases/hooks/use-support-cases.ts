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
  CreateSupportCaseRequest,
  SupportCaseMessageRequest,
  SupportCaseTransitionRequest,
  AsyncJobAck,
  SupportCaseListParams,
} from "@/types/support-case";

// ── Centralised query keys (keeps invalidation honest) ────────────────
export const supportCaseKeys = {
  all: ["support-cases"] as const,
  list: (params?: SupportCaseListParams) =>
    ["support-cases", "list", params ?? {}] as const,
  detail: (id: string) => ["support-cases", "detail", id] as const,
  messages: (id: string) => ["support-cases", "messages", id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────

/** List this tenant's support cases with optional filters. */
export function useSupportCases(params?: SupportCaseListParams) {
  return useQuery<SupportCase[]>({
    queryKey: supportCaseKeys.list(params),
    queryFn: () => apiGet<SupportCase[]>("/support-cases", params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch a single case + its thread in one call. Internal admin notes are
 * stripped by the backend for tenant callers.
 */
export function useSupportCase(caseId: string) {
  return useQuery<SupportCaseDetail>({
    queryKey: supportCaseKeys.detail(caseId),
    queryFn: () => apiGet<SupportCaseDetail>(`/support-cases/${caseId}`),
    enabled: !!caseId,
  });
}

/**
 * Thread-only endpoint. Auto-refreshes every 10s so replies show up in
 * near-real-time without a page reload.
 */
export function useSupportCaseMessages(caseId: string, enabled = true) {
  return useQuery<SupportCaseMessage[]>({
    queryKey: supportCaseKeys.messages(caseId),
    queryFn: () =>
      apiGet<SupportCaseMessage[]>(`/support-cases/${caseId}/messages`),
    enabled: !!caseId && enabled,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────

/** Open a new case. Returns the async ack; poll `jobId` to see it settle. */
export function useCreateSupportCase() {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, CreateSupportCaseRequest>({
    mutationFn: (data) => apiPost<AsyncJobAck>("/support-cases", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.all });
    },
  });
}

/**
 * Post a reply to a case. `internalNote` is silently forced to `false` for
 * tenant callers by the server, so we don't expose it here.
 *
 * Endpoint routing: replies that carry attachments MUST go to
 * `/support-cases/{id}/attachments` — that is the only endpoint that
 * registers the uploaded object keys on the thread. Plain-text replies go
 * to `/support-cases/{id}/messages` as before.
 */
export function useReplySupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    AsyncJobAck,
    Error,
    Omit<SupportCaseMessageRequest, "internalNote">
  >({
    mutationFn: (data) => {
      const hasAttachments = (data.attachments?.length ?? 0) > 0;
      const path = hasAttachments
        ? `/support-cases/${caseId}/attachments`
        : `/support-cases/${caseId}/messages`;
      return apiPost<AsyncJobAck>(path, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.messages(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.all });
    },
  });
}

/** Confirm resolution — only legal from `resolved`. */
export function useCloseSupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, void>({
    mutationFn: () => apiPost<AsyncJobAck>(`/support-cases/${caseId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.all });
    },
  });
}

/** Reopen a resolved case. */
export function useReopenSupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, void>({
    mutationFn: () => apiPost<AsyncJobAck>(`/support-cases/${caseId}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.all });
    },
  });
}

/** Generic state-machine transition (server rejects illegal pairs). */
export function useTransitionSupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, SupportCaseTransitionRequest>({
    mutationFn: (data) =>
      apiPost<AsyncJobAck>(`/support-cases/${caseId}/transition`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.all });
    },
  });
}

// Attachment flow:
//   1. `uploadSupportCaseAttachment` (in features/support-cases/lib) asks for
//      a presigned URL and PUTs the file bytes directly to storage.
//   2. `useReplySupportCase` registers the uploaded object keys by posting
//      to `/support-cases/{id}/attachments` when attachments are present.
