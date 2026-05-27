"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import type { PrivacyNotice } from "@/types/dpo";
import type { NoticeDisplayMode } from "@/types/enums";
import type { Block } from "@/types/blog";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    skip?: number;
    limit?: number;
  };
}

export interface CreatePrivacyNoticeRequest {
  title: string;
  summary?: string;
  /** Canonical rich content — BlockNote blocks. The server derives `fullText`
   * from this. */
  body?: Block[];
  displayMode: NoticeDisplayMode;
  effectiveDate?: number;
}

export interface UpdatePrivacyNoticeRequest {
  title?: string;
  summary?: string;
  /** Send the full block array from the editor. Editing it mints a new
   * `versionId`. */
  body?: Block[];
  displayMode?: NoticeDisplayMode;
  isActive?: boolean;
  effectiveDate?: number;
}

interface UsePrivacyNoticesParams {
  skip?: number;
  limit?: number;
}

/**
 * Fetch all privacy notices with optional pagination
 */
export function usePrivacyNotices(params?: UsePrivacyNoticesParams) {
  return useQuery<PaginatedResponse<PrivacyNotice>>({
    queryKey: ["privacy-notices", params],
    queryFn: () =>
      apiGet<PaginatedResponse<PrivacyNotice>>(
        "/privacy-notices",
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
      apiGet<PrivacyNotice>("/privacy-notices/active"),
  });
}

/**
 * Create a new privacy notice
 */
export function useCreatePrivacyNotice() {
  const queryClient = useQueryClient();

  return useMutation<PrivacyNotice, Error, CreatePrivacyNoticeRequest>({
    mutationFn: (data) =>
      apiPost<PrivacyNotice>("/privacy-notices", data),
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
        `/privacy-notices/${noticeId}`,
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
