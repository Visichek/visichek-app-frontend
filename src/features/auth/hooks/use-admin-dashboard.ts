'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/request';
import type {
  AdminDashboardStats,
  AdminBillingSummary,
  AdminTenant,
} from '@/types/admin';
import type { Tenant, TenantBootstrapRequest } from '@/types/tenant';

/**
 * Query key factory for admin dashboard and tenant-related queries
 */
const adminKeys = {
  all: ['admin'] as const,
  dashboards: () => ['admin', 'dashboard'] as const,
  stats: () => ['admin', 'dashboard', 'stats'] as const,
  billing: () => ['admin', 'dashboard', 'billing'] as const,
  tenants: () => ['admin', 'tenants'] as const,
  tenantList: (filters?: Record<string, unknown>) =>
    ['admin', 'tenants', 'list', filters] as const,
  tenantDetail: (id: string) => ['admin', 'tenants', 'detail', id] as const,
};

/**
 * Fetch platform admin dashboard statistics.
 * Admin only.
 */
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const data = await apiGet<AdminDashboardStats>(
        '/admins/dashboard/stats'
      );
      return data;
    },
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Fetch admin billing summary.
 * Admin only.
 */
export function useAdminBillingSummary() {
  return useQuery({
    queryKey: adminKeys.billing(),
    queryFn: async () => {
      const data = await apiGet<AdminBillingSummary>(
        '/admins/dashboard/billing'
      );
      return data;
    },
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Fetch list of all tenants.
 * Admin only - accessible via super admin token flow.
 */
export function useTenantList(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.tenantList(filters),
    queryFn: async () => {
      const data = await apiGet<AdminTenant[]>('/tenants/', filters);
      return data;
    },
    staleTime: 30000,
  });
}

/**
 * Fetch a single tenant by ID.
 * Admin only.
 */
export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: adminKeys.tenantDetail(tenantId),
    queryFn: async () => {
      const data = await apiGet<AdminTenant>(`/tenants/${tenantId}`);
      return data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });
}

/**
 * Mutation for bootstrapping a new tenant with its first super admin.
 * Admin only - creates a tenant and first super admin in one operation.
 */
export function useBootstrapTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: TenantBootstrapRequest) => {
      const data = await apiPost<Tenant>(
        '/admins/tenants/bootstrap',
        request
      );
      return data;
    },
    onSuccess: (newTenant) => {
      // Invalidate all tenant lists
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      // Cache the new tenant
      queryClient.setQueryData(
        adminKeys.tenantDetail(newTenant.id),
        newTenant
      );
    },
  });
}
