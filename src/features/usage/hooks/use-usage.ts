'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/request';
import { useAppSelector } from '@/lib/store/hooks';
import { selectIsAuthenticated } from '@/lib/store/session-slice';
import type { TenantUsageSummary } from '@/types/billing';

/**
 * Query key factory for usage-related queries
 */
const usageKeys = {
  all: ['usage'] as const,
  my: () => ['usage', 'my-usage'] as const,
  tenant: (tenantId: string) => ['usage', 'tenant', tenantId] as const,
};

/**
 * Fetch current user's usage summary.
 * Available to any authenticated user (admin or system user).
 */
export function useMyUsage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return useQuery({
    queryKey: usageKeys.my(),
    queryFn: async () => {
      const data = await apiGet<TenantUsageSummary>('/usage/my-usage');
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Fetch tenant usage summary.
 * Admin only - fetch usage for a specific tenant.
 */
export function useTenantUsage(tenantId: string) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return useQuery({
    queryKey: usageKeys.tenant(tenantId),
    queryFn: async () => {
      const data = await apiGet<TenantUsageSummary>(
        `/usage/tenant/${tenantId}/summary`
      );
      return data;
    },
    enabled: !!tenantId && isAuthenticated,
    staleTime: 300000, // 5 minutes
  });
}
