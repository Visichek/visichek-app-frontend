'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/request';
import { apiGetList } from '@/lib/api/list';
import { bulkAction } from '@/lib/api/bulk';
import type {
  Branch,
  BranchContactSummary,
  OrgContactSummary,
} from '@/types/tenant';
import type { ListResponse, BulkJobResult } from '@/types/list';

/**
 * Query key factory for branch-related queries
 */
const branchKeys = {
  all: ['branches'] as const,
  lists: () => ['branches', 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    ['branches', 'list', filters] as const,
  details: () => ['branches', 'detail'] as const,
  detail: (id: string) => ['branches', 'detail', id] as const,
  contact: (id: string) => ['branches', 'contact', id] as const,
  orgContact: () => ['branches', 'org-contact'] as const,
};

/**
 * Fetch the paginated branches list. Returns the new `{ items, meta }`
 * envelope per tables.txt §2.3.
 */
export function useBranches(filters?: Record<string, unknown>) {
  return useQuery<ListResponse<Branch>>({
    queryKey: branchKeys.list(filters),
    queryFn: () => apiGetList<Branch>('/branches', filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch a single branch by ID.
 */
export function useBranch(branchId: string) {
  return useQuery({
    queryKey: branchKeys.detail(branchId),
    queryFn: async () => {
      const data = await apiGet<Branch>(`/branches/${branchId}`);
      return data;
    },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Resolved point of contact for a branch (WS4):
 * `GET /v1/branches/{branch_id}/contact`. The server resolves the
 * designated contact user → branch email/phone fallback → main super
 * admin, so a summary is always returned when the branch exists.
 */
export function useBranchContact(branchId: string, enabled = true) {
  return useQuery<BranchContactSummary>({
    queryKey: branchKeys.contact(branchId),
    queryFn: () => apiGet<BranchContactSummary>(`/branches/${branchId}/contact`),
    enabled: enabled && !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Organization point of contact (WS4): the main super admin card from
 * `GET /v1/tenants/me/contact`.
 */
export function useOrgContact(enabled = true) {
  return useQuery<OrgContactSummary>({
    queryKey: branchKeys.orgContact(),
    queryFn: () => apiGet<OrgContactSummary>('/tenants/me/contact'),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation for creating a branch.
 * Invalidates the branches list on success.
 */
export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      request: Omit<Branch, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    ) => {
      const data = await apiPost<Branch>('/branches', request);
      return data;
    },
    onSuccess: (newBranch) => {
      // Invalidate all branches lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      // Optionally cache the new branch
      queryClient.setQueryData(branchKeys.detail(newBranch.id), newBranch);
    },
  });
}

/**
 * Mutation for updating a branch.
 * Invalidates the branches list and the specific branch on success.
 */
export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      branchId,
      data,
    }: {
      branchId: string;
      data: Partial<
        Omit<Branch, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
      >;
    }) => {
      const result = await apiPut<Branch>(`/branches/${branchId}`, data);
      return result;
    },
    onSuccess: (updatedBranch) => {
      // Invalidate all branches lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      // Update the specific branch in cache
      queryClient.setQueryData(branchKeys.detail(updatedBranch.id), updatedBranch);
      // The point-of-contact designation may have changed (WS4).
      queryClient.invalidateQueries({
        queryKey: branchKeys.contact(updatedBranch.id),
      });
    },
  });
}

/**
 * Mutation for deactivating a branch.
 * Invalidates the branches list and the specific branch on success.
 */
export function useDeactivateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branchId: string) => {
      const data = await apiPost<Branch>(
        `/branches/${branchId}/deactivate`,
        {}
      );
      return data;
    },
    onSuccess: (updatedBranch) => {
      // Invalidate all branches lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      // Update the specific branch in cache
      queryClient.setQueryData(branchKeys.detail(updatedBranch.id), updatedBranch);
    },
  });
}

/**
 * Mutation for deleting a branch.
 * Invalidates the branches list on success.
 */
export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branchId: string) => {
      await apiDelete(`/branches/${branchId}`);
    },
    onSuccess: (_, branchId) => {
      // Invalidate all branches lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      // Remove the deleted branch from cache
      queryClient.removeQueries({
        queryKey: branchKeys.detail(branchId),
      });
    },
  });
}

/**
 * Bulk deactivate / delete branches per tables.txt §2.3. Backend still
 * enforces last-active-branch protection — protected ids land in `failed[]`.
 */
export function useBulkBranchAction(action: "deactivate" | "delete") {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult, Error, { ids: string[]; atomic?: boolean }>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction(`/branches/bulk/${action}`, ids, { atomic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
    },
  });
}
