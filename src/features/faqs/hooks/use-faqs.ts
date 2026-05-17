"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch } from "@/lib/api/request";
import type {
  FaqsDeleteKind,
  FaqsPatchPayload,
  FaqsResponse,
} from "@/types/faqs";

const FAQS_KEY = ["faqs"] as const;

/**
 * Public rendered FAQ payload. Public endpoint — no auth. Backend
 * serves a precomputed cache that gets invalidated on every PATCH
 * or DELETE to this endpoint.
 */
export function useFaqs() {
  return useQuery<FaqsResponse>({
    queryKey: FAQS_KEY,
    queryFn: () => apiGet<FaqsResponse>("/faqs"),
    staleTime: 60 * 1000,
  });
}

/**
 * Partial update of the FAQ overlay. Backend returns 202 + queued
 * job; `apiPatch` auto-polls the ack so this mutation stays pending
 * until the worker has committed and the cache is refreshed.
 */
export function useUpdateFaqs() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, FaqsPatchPayload>({
    mutationFn: (payload) => apiPatch("/faqs", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAQS_KEY });
    },
  });
}

interface DeleteFaqRowVars {
  kind: FaqsDeleteKind;
  key: string;
}

/**
 * Remove one overlay row by natural key. For default code-shipped
 * categories (general / billing / security / support) the defaults
 * auto-reappear on the next render. Items that pointed at a deleted
 * custom category get parked under "general".
 */
export function useDeleteFaqRow() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, DeleteFaqRowVars>({
    mutationFn: ({ kind, key }) =>
      apiDelete(`/faqs/${kind}/${encodeURIComponent(key)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAQS_KEY });
    },
  });
}
