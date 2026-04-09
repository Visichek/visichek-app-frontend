'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { apiGet, apiPut, apiDelete } from '@/lib/api/request';
import type { TenantBranding } from '@/types/tenant';

// ─── Document upload helper ───────────────────────────────────────────────────

// The document API may return snake_case or camelCase depending on the
// X-Response-Case header. Accept either form so the helper is resilient.
interface DocumentOut {
  id?: string;
  objectKey?: string;
  object_key?: string;
}

/**
 * Upload a logo using the direct upload strategy (`POST /v1/documents`).
 * Returns the storage object key the backend assigned.
 *
 * Logos are small (<<50 MB limit), so the single-request strategy is the
 * right call here — no presigned URL handling, no storage-backend branching.
 */
async function uploadLogoFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  // Use apiClient directly so axios sets the multipart boundary header
  // automatically (instead of our default `application/json`).
  const response = await apiClient.post<DocumentOut>('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const doc = response.data;
  const objectKey = doc.objectKey ?? doc.object_key;

  if (!objectKey) {
    throw new Error('Document upload succeeded but no object key was returned.');
  }

  return objectKey;
}

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

export interface UpdateBrandingInput {
  branding: Partial<TenantBranding>;
  logoFile?: File;
}

/**
 * Mutation for updating tenant branding.
 * Super admin only - creates or updates branding configuration.
 * If `logoFile` is provided it is uploaded via the document upload flow before
 * the branding record is saved, and the resulting object key is attached.
 */
export function useUpdateBranding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ branding, logoFile }: UpdateBrandingInput) => {
      let logoObjectKey: string | undefined;

      if (logoFile) {
        logoObjectKey = await uploadLogoFile(logoFile);
      }

      const payload: Partial<TenantBranding> = {
        ...branding,
        ...(logoObjectKey ? { logoObjectKey } : {}),
      };

      const data = await apiPut<TenantBranding>('/branding', payload);
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
