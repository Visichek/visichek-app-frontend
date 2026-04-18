'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/request';
import type { Branch } from '@/types/tenant';

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
};

/**
 * Fetch all branches with optional filters.
 */
export function useBranches(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: branchKeys.list(filters),
    queryFn: async () => {
      const data = await apiGet<Branch[]>('/branches', filters);
      return data;
    },
    staleTime: 5 * 60 * 1000,
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
