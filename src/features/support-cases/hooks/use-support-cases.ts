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
  AttachmentIntentRequest,
  AttachmentIntentResponse,
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
 */
export function useReplySupportCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    AsyncJobAck,
    Error,
    Omit<SupportCaseMessageRequest, "internalNote">
  >({
    mutationFn: (data) =>
      apiPost<AsyncJobAck>(`/support-cases/${caseId}/messages`, data),
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

// ── Attachment flow (3 steps) ─────────────────────────────────────────

/**
 * Step 1: ask the backend for a presigned S3 URL. The returned `objectKey`
 * is what we register in step 3.
 */
export function useCreateAttachmentIntent(caseId: string) {
  return useMutation<AttachmentIntentResponse, Error, AttachmentIntentRequest>({
    mutationFn: (data) =>
      apiPost<AttachmentIntentResponse>(
        `/support-cases/${caseId}/attachments/intent`,
        data,
      ),
  });
}

/**
 * Step 3: register the uploaded file(s) as a thread message. Body may be a
 * short caption; attachments array carries the object keys. Step 2 (the raw
 * S3 PUT) is done directly by `uploadSupportCaseAttachment` below.
 */
export function useRegisterAttachment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    AsyncJobAck,
    Error,
    Omit<SupportCaseMessageRequest, "internalNote">
  >({
    mutationFn: (data) =>
      apiPost<AsyncJobAck>(`/support-cases/${caseId}/attachments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.messages(caseId) });
      queryClient.invalidateQueries({ queryKey: supportCaseKeys.all });
    },
  });
}
