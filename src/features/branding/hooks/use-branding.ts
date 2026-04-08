'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiDelete } from '@/lib/api/request';
import type { TenantBranding } from '@/types/tenant';

/**
 * Query key factory for branding-related queries
 */
const brandingKeys = {
  all: ['branding'] as const,
  configs: () => ['branding', 'config'] as const,
  config: (tenantId: string) => ['branding', 'config', tenantId] as const,
};

/**
 * Fetch tenant branding configuration.
 * Can be called by any authenticated system user.
 */
export function useTenantBrandingConfig(tenantId: string) {
  return useQuery({
    queryKey: brandingKeys.config(tenantId),
    queryFn: async () => {
      const data = await apiGet<TenantBranding>(
        `/branding/tenant/${tenantId}`
      );
      return data;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}

/**
 * Mutation for updating tenant branding.
 * Super admin only - creates or updates branding configuration.
 */
export function useUpdateBranding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branding: Partial<TenantBranding>) => {
      const data = await apiPut<TenantBranding>('/branding', branding);
      return data;
    },
    onSuccess: (updatedBranding) => {
      // Invalidate the branding config for the tenant
      queryClient.invalidateQueries({
        queryKey: brandingKeys.config(updatedBranding.tenantId),
      });
      // Update cache
      queryClient.setQueryData(
        brandingKeys.config(updatedBranding.tenantId),
        updatedBranding
      );
    },
  });
}

/**
 * Mutation for resetting tenant branding to defaults.
 * Super admin only - removes custom branding and restores defaults.
 */
export function useResetBranding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      await apiDelete(`/branding`);
      return tenantId;
    },
    onSuccess: (tenantId) => {
      // Invalidate the branding config for the tenant
      queryClient.invalidateQueries({
        queryKey: brandingKeys.config(tenantId),
      });
    },
  });
}
