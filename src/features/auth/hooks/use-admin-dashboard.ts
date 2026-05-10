'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api/request';
import { apiGetList } from '@/lib/api/list';
import { bulkAction } from '@/lib/api/bulk';
import type { ListResponse, BulkJobResult } from '@/types/list';
import type {
  AdminDashboardStats,
  AdminBillingSummary,
  AdminTenant,
} from '@/types/admin';
import type { Tenant, TenantBootstrapRequest } from '@/types/tenant';
import type {
  AddTenantSuperAdminRequest,
  AddTenantSuperAdminResponse,
  ResetUserPasswordRequest,
  ResetUserPasswordResponse,
} from '@/types/user';

export type { AdminTenant };

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
 * Admin only. The endpoint is precompute-cached server-side with a 120s TTL
 * (refreshed every 60s by the APScheduler fanout, dropped immediately on any
 * tenant write touching subscriptions/billing/tenants/users), so polling at
 * 60s keeps the UI close to fresh without burning request budget.
 */
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => apiGet<AdminDashboardStats>('/admins/dashboard/stats'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
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
 * Fetch the paginated tenant list.
 *
 * Returns the new `{ items, meta }` envelope verbatim. `meta.total` is the
 * total matching the filter set; `meta.facets` is populated when the caller
 * passes `?facets=status` (etc.) and the resource has the field on its
 * server-side facet allowlist.
 *
 * Admin only — accessible via super admin token flow.
 */
export function useTenantList(filters?: Record<string, unknown>) {
  return useQuery<ListResponse<AdminTenant>>({
    queryKey: adminKeys.tenantList(filters),
    queryFn: () => apiGetList<AdminTenant>('/tenants', filters),
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

/**
 * Preview offboarding impact for a tenant.
 */
export function useOffboardingSummary(tenantId: string) {
  return useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'offboarding-summary'],
    queryFn: () => apiGet<Record<string, unknown>>(`/admins/tenants/${tenantId}/offboarding-summary`),
    enabled: !!tenantId,
  });
}

/**
 * Start tenant offboarding for a single tenant.
 */
export function useOffboardTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tenantId: string) =>
      apiPost<Record<string, unknown>>(`/admins/tenants/${tenantId}/offboard`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
    },
  });
}

/**
 * Bulk-offboard multiple tenants in a single queued job.
 * Maps to `POST /v1/tenants/bulk/offboard` per tables.txt §1.1.
 */
export function useBulkOffboardTenants() {
  const queryClient = useQueryClient();

  return useMutation<
    BulkJobResult,
    Error,
    { ids: string[]; reason?: string; atomic?: boolean }
  >({
    mutationFn: ({ ids, reason, atomic }) =>
      bulkAction('/tenants/bulk/offboard', ids, {
        atomic,
        extras: reason ? { reason } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
    },
  });
}

/**
 * Delete a tenant entirely (hard delete — admin only).
 */
export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tenantId: string) =>
      apiDelete(`/tenants/${tenantId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
    },
  });
}

/**
 * Add a super_admin to an EXISTING tenant (app-admin only).
 *
 * Distinct from `useBootstrapTenant`, which creates the tenant + first
 * super_admin together. Use this when:
 *   - the previous super_admin was offboarded
 *   - adding a secondary super_admin for redundancy
 *   - restoring access for a tenant that lost their credentials
 *
 * Returns the new user along with access + refresh tokens — surface them
 * in a copy-to-clipboard "send out-of-band" modal. The API does NOT
 * email these credentials.
 *
 * Server validations:
 *   - Tenant must exist and be active (400 otherwise).
 *   - Email must be GLOBALLY unique across system_users (409 otherwise).
 *   - Plan caps + branch validation apply just like a normal invite.
 */
export function useAddTenantSuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      data,
    }: {
      tenantId: string;
      data: AddTenantSuperAdminRequest;
    }) => {
      const result = await apiPost<AddTenantSuperAdminResponse>(
        `/admins/tenants/${tenantId}/super-admins`,
        data
      );
      return result;
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminKeys.tenantDetail(variables.tenantId),
      });
      // The tenant's user-count summary may shift on the list response.
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
    },
  });
}

/**
 * Reset any system_user's password (app-admin path — unscoped).
 *
 * Hits POST /v1/admins/system-users/{user_id}/reset-password. App admins
 * can target users in any tenant including super_admins — used to
 * support locked-out tenants.
 *
 * Side effects mirror the super_admin reset path: revokes every active
 * token for the target, drops the gate cache, and writes an audit row.
 *
 * The 422 path returns the same shape as /v1/auth/change-password —
 * surface policy errors inline against the password field.
 */
export function useAdminResetSystemUserPassword() {
  return useMutation({
    mutationFn: async ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
    }) => {
      const body: ResetUserPasswordRequest = { newPassword };
      const data = await apiPost<ResetUserPasswordResponse>(
        `/admins/system-users/${userId}/reset-password`,
        body
      );
      return data;
    },
  });
}
