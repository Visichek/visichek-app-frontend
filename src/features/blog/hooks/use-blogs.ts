"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import type {
  Blog,
  BlogListItem,
  CreateBlogPayload,
  UpdateBlogPayload,
} from "@/types/blog";
import type { ListResponse } from "@/types/list";

export interface UseBlogsParams {
  skip?: number;
  limit?: number;
  sort?: string;
  q?: string;
  state?: string;
  blogType?: string;
  category?: string;
  author?: string;
  facets?: string;
}

/**
 * Paginated admin blog list. Default first page is precomputed on the
 * backend, so the unfiltered request is fast.
 */
export function useBlogs(params?: UseBlogsParams) {
  return useQuery<ListResponse<BlogListItem>>({
    queryKey: ["blogs", params],
    queryFn: () =>
      apiGetList<BlogListItem>(
        "/blogs",
        params as Record<string, unknown> | undefined,
      ),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** Single blog (admin view — includes drafts). */
export function useBlog(blogId: string | undefined) {
  return useQuery<Blog>({
    queryKey: ["blogs", blogId],
    queryFn: () => apiGet<Blog>(`/blogs/${blogId}`),
    enabled: !!blogId,
    staleTime: 30 * 1000,
  });
}

/**
 * Create blog. Returns the resource id once the backend worker has
 * committed (request.ts auto-polls the 202 ack).
 */
export function useCreateBlog() {
  const queryClient = useQueryClient();
  return useMutation<Blog & { id: string }, Error, CreateBlogPayload>({
    mutationFn: (data) => apiPost<Blog & { id: string }>("/blogs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
  });
}

/** Update blog. */
export function useUpdateBlog(blogId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateBlogPayload>({
    mutationFn: (data) => apiPatch(`/blogs/${blogId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs", blogId] });
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
  });
}

/** Delete blog. */
export function useDeleteBlog() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (blogId) => apiDelete(`/blogs/${blogId}`),
    onSuccess: (_, blogId) => {
      queryClient.invalidateQueries({ queryKey: ["blogs", blogId] });
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
  });
}
