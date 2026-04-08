'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/request';
import type { Department } from '@/types/tenant';

/**
 * Query key factory for department-related queries
 */
const departmentKeys = {
  all: ['departments'] as const,
  lists: () => ['departments', 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    ['departments', 'list', filters] as const,
  details: () => ['departments', 'detail'] as const,
  detail: (id: string) => ['departments', 'detail', id] as const,
};

/**
 * Fetch all departments with optional filters.
 */
export function useDepartments(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: departmentKeys.list(filters),
    queryFn: async () => {
      const data = await apiGet<Department[]>('/departments/', filters);
      return data;
    },
    staleTime: 30000,
  });
}

/**
 * Fetch a single department by ID.
 */
export function useDepartment(departmentId: string) {
  return useQuery({
    queryKey: departmentKeys.detail(departmentId),
    queryFn: async () => {
      const data = await apiGet<Department>(
        `/departments/${departmentId}`
      );
      return data;
    },
    enabled: !!departmentId,
    staleTime: 30000,
  });
}

/**
 * Mutation for creating a department.
 * Invalidates the departments list on success.
 */
export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: Omit<Department, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
      const data = await apiPost<Department>('/departments/', request);
      return data;
    },
    onSuccess: (newDepartment) => {
      // Invalidate all departments lists
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      // Optionally cache the new department
      queryClient.setQueryData(
        departmentKeys.detail(newDepartment.id),
        newDepartment
      );
    },
  });
}

/**
 * Mutation for updating a department.
 * Invalidates the departments list and the specific department on success.
 */
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      departmentId,
      data,
    }: {
      departmentId: string;
      data: Partial<Omit<Department, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
    }) => {
      const result = await apiPatch<Department>(
        `/departments/${departmentId}`,
        data
      );
      return result;
    },
    onSuccess: (updatedDepartment) => {
      // Invalidate all departments lists
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      // Update the specific department in cache
      queryClient.setQueryData(
        departmentKeys.detail(updatedDepartment.id),
        updatedDepartment
      );
    },
  });
}

/**
 * Mutation for deleting a department.
 * Invalidates the departments list on success.
 */
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (departmentId: string) => {
      await apiDelete(`/departments/${departmentId}`);
    },
    onSuccess: (_, departmentId) => {
      // Invalidate all departments lists
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      // Remove the deleted department from cache
      queryClient.removeQueries({
        queryKey: departmentKeys.detail(departmentId),
      });
    },
  });
}
