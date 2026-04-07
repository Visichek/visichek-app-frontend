"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import type { PrivacyNotice } from "@/types/dpo";
import type { NoticeDisplayMode } from "@/types/enums";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

export interface CreatePrivacyNoticeRequest {
  title: string;
  summary?: string;
  full_text?: string;
  display_mode: NoticeDisplayMode;
  effective_date?: number;
}

export interface UpdatePrivacyNoticeRequest {
  title?: string;
  summary?: string;
  full_text?: string;
  display_mode?: NoticeDisplayMode;
  is_active?: boolean;
  effective_date?: number;
}

interface UsePrivacyNoticesParams {
  start?: number;
  stop?: number;
}

/**
 * Fetch all privacy notices with optional pagination
 */
export function usePrivacyNotices(params?: UsePrivacyNoticesParams) {
  return useQuery<PaginatedResponse<PrivacyNotice>>({
    queryKey: ["privacy-notices", params],
    queryFn: () =>
      apiGet<PaginatedResponse<PrivacyNotice>>(
        "/v1/privacy-notices",
        params
      ),
  });
}

/**
 * Fetch the currently active privacy notice
 */
export function useActivePrivacyNotice() {
  return useQuery<PrivacyNotice>({
    queryKey: ["privacy-notices", "active"],
    queryFn: () =>
      apiGet<PrivacyNotice>("/v1/privacy-notices/active"),
  });
}

/**
 * Create a new privacy notice
 */
export function useCreatePrivacyNotice() {
  const queryClient = useQueryClient();

  return useMutation<PrivacyNotice, Error, CreatePrivacyNoticeRequest>({
    mutationFn: (data) =>
      apiPost<PrivacyNotice>("/v1/privacy-notices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy-notices"] });
    },
  });
}

/**
 * Update an existing privacy notice
 */
export function useUpdatePrivacyNotice(noticeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    PrivacyNotice,
    Error,
    UpdatePrivacyNoticeRequest
  >({
    mutationFn: (data) =>
      apiPatch<PrivacyNotice>(
        `/v1/privacy-notices/${noticeId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["privacy-notices"],
      });
      queryClient.invalidateQueries({
        queryKey: ["privacy-notices", "active"],
      });
    },
  });
}
