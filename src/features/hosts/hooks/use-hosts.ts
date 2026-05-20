"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { bulkAction } from "@/lib/api/bulk";
import type { AsyncJobAck } from "@/types/job";
import type { ListResponse, BulkJobResult } from "@/types/list";
import type {
  Host,
  HostWithSummary,
  HostCreateRequest,
  HostUpdateRequest,
} from "@/types/host";

/**
 * Query-key factory for host-related queries.
 */
export const hostKeys = {
  all: ["hosts"] as const,
  lists: () => ["hosts", "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    ["hosts", "list", filters] as const,
  details: () => ["hosts", "detail"] as const,
  detail: (id: string) => ["hosts", "detail", id] as const,
};

/**
 * Paginated hosts list (`GET /v1/hosts`). Supports `q` (name/email/phone),
 * `sort` (name | dateCreated | lastUpdated, default name asc),
 * `departmentId`, `isActive`, and skip/limit pagination. The unfiltered
 * first page is served from the backend precompute cache; filtered queries
 * fall through to run_list — transparent to the FE.
 */
export function useHosts(filters?: Record<string, unknown>) {
  return useQuery<ListResponse<Host>>({
    queryKey: hostKeys.list(filters),
    queryFn: () => apiGetList<Host>("/hosts", filters),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Single host with embedded summaries (`GET /v1/hosts/{id}`).
 */
export function useHost(hostId: string) {
  return useQuery<HostWithSummary>({
    queryKey: hostKeys.detail(hostId),
    queryFn: () => apiGet<HostWithSummary>(`/hosts/${hostId}`),
    enabled: !!hostId,
    staleTime: 30_000,
  });
}

/**
 * Create a host. Queued write — we read the 202 ack verbatim
 * (`asyncJob: "raw"`) so the caller gets the pre-assigned, authoritative
 * `id` and can route to `/app/hosts/{id}` immediately without waiting on the
 * worker. Validation failures (409 duplicate name, 404 bad department /
 * system user) are raised synchronously on this response and surface as a
 * thrown ApiError before the 202 — no job poll needed.
 */
export function useCreateHost() {
  const queryClient = useQueryClient();
  return useMutation<AsyncJobAck, Error, HostCreateRequest>({
    mutationFn: (request) =>
      apiPost<AsyncJobAck>("/hosts", request, { asyncJob: "raw" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hostKeys.lists() });
    },
  });
}

/**
 * Update a host. Queued write — auto-polls the job so the button stays
 * pending until the worker settles, then invalidates. `sourceSystemUserId`
 * is intentionally not part of `HostUpdateRequest` (rejected on PATCH).
 */
export function useUpdateHost() {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { hostId: string; data: HostUpdateRequest }
  >({
    mutationFn: ({ hostId, data }) =>
      apiPatch<unknown>(`/hosts/${hostId}`, data),
    onSuccess: (_result, { hostId }) => {
      queryClient.invalidateQueries({ queryKey: hostKeys.lists() });
      queryClient.invalidateQueries({ queryKey: hostKeys.detail(hostId) });
    },
  });
}

/**
 * Delete a single host (super_admin only). Queued write — auto-polls so the
 * row is gone by the time we invalidate.
 */
export function useDeleteHost() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (hostId) => apiDelete<unknown>(`/hosts/${hostId}`),
    onSuccess: (_result, hostId) => {
      queryClient.invalidateQueries({ queryKey: hostKeys.lists() });
      queryClient.removeQueries({ queryKey: hostKeys.detail(hostId) });
    },
  });
}

/**
 * Bulk delete hosts (super_admin only) via a single queued job.
 */
export function useBulkDeleteHosts() {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult, Error, { ids: string[]; atomic?: boolean }>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction("/hosts/bulk/delete", ids, { atomic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hostKeys.lists() });
    },
  });
}
