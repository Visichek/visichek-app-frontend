'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/request';
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
  return useQuery({
    queryKey: usageKeys.my(),
    queryFn: async () => {
      const data = await apiGet<TenantUsageSummary>('/usage/my-usage');
      return data;
    },
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Fetch tenant usage summary.
 * Admin only - fetch usage for a specific tenant.
 */
export function useTenantUsage(tenantId: string) {
  return useQuery({
    queryKey: usageKeys.tenant(tenantId),
    queryFn: async () => {
      const data = await apiGet<TenantUsageSummary>(
        `/usage/tenant/${tenantId}/summary`
      );
      return data;
    },
    enabled: !!tenantId,
    staleTime: 300000, // 5 minutes
  });
}
