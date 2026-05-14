"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { apiGet, apiDelete } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { pollJob } from "@/lib/jobs/poll";
import { AsyncJobError, AsyncJobTimeoutError } from "@/lib/jobs/async-job-error";
import type { AsyncJobAck } from "@/types/job";
import type { MediaItem, MediaUploadResult } from "@/types/blog";
import type { ListResponse } from "@/types/list";

export interface UseMediaParams {
  skip?: number;
  limit?: number;
  sort?: string;
  q?: string;
  mediaType?: string;
  category?: string;
  facets?: string;
}

/** Paginated media library (admin view). */
export function useMediaList(params?: UseMediaParams) {
  return useQuery<ListResponse<MediaItem>>({
    queryKey: ["media", params],
    queryFn: () =>
      apiGetList<MediaItem>(
        "/media",
        params as Record<string, unknown> | undefined,
      ),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** Single media row. */
export function useMedia(mediaId: string | undefined) {
  return useQuery<MediaItem>({
    queryKey: ["media", mediaId],
    queryFn: () => apiGet<MediaItem>(`/media/${mediaId}`),
    enabled: !!mediaId,
  });
}

async function postMultipartAndPoll<T>(
  url: string,
  form: FormData,
): Promise<T> {
  const response = await apiClient.post(url, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (response.status !== 202) {
    return response.data as T;
  }

  const ack = response.data as AsyncJobAck;
  const job = await pollJob<T>(ack.jobId);

  if (job.status === "failed") {
    throw new AsyncJobError<T>(ack, job);
  }
  if (job.status !== "succeeded") {
    throw new AsyncJobTimeoutError<T>(ack, job);
  }
  return (job.result ?? (undefined as unknown)) as T;
}

/**
 * Upload raw image or video without creating a media-library row. Useful for
 * one-off uploads (feature image, inline editor media) where the URL is the
 * only thing the caller needs.
 */
export function useUploadMediaFile() {
  return useMutation<MediaUploadResult, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("file", file);
      return postMultipartAndPoll<MediaUploadResult>(
        "/media/upload-media",
        form,
      );
    },
  });
}

interface CreateMediaInput {
  file: File;
  category: string;
}

/**
 * Upload + create a `media` library row. Returns the new row id and URL.
 */
export function useCreateMedia() {
  const queryClient = useQueryClient();
  return useMutation<MediaUploadResult, Error, CreateMediaInput>({
    mutationFn: async ({ file, category }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      return postMultipartAndPoll<MediaUploadResult>("/media", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });
}

interface UpdateMediaCategoryInput {
  mediaId: string;
  category: string;
}

/** Update the category on an existing media row. */
export function useUpdateMediaCategory() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateMediaCategoryInput>({
    mutationFn: async ({ mediaId, category }) => {
      const { apiPatch } = await import("@/lib/api/request");
      return apiPatch(`/media/${mediaId}`, { category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });
}

/** Delete a media row (the underlying object is reaped asynchronously). */
export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (mediaId) => apiDelete(`/media/${mediaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });
}
