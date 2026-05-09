"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api/request";
import { ApiError } from "@/types/api";
import {
  tenantFormArchivePath,
  tenantFormByTargetPath,
  tenantFormClonePath,
  tenantFormCreatePath,
  tenantFormDetailPath,
  tenantFormsListPath,
} from "../lib/endpoints";
import { tenantFormKeys } from "../lib/query-keys";
import type {
  FormTargetType,
  TenantForm,
  TenantFormCreateInput,
  TenantFormListParams,
  TenantFormUpdateInput,
} from "../types";

/**
 * List forms for the current tenant. Tenant context comes from the auth
 * cookie; we still key the cache by tenantId so a tenant switch does not
 * surface stale data.
 */
export function useTenantForms(
  tenantId: string | undefined,
  params: TenantFormListParams = {},
) {
  return useQuery({
    queryKey: tenantFormKeys.list(tenantId ?? "", params),
    queryFn: () =>
      apiGet<TenantForm[]>(tenantFormsListPath(), params as Record<string, unknown>),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/** Resolve the active form for a given target_type. 404 → null. */
export function useActiveTenantForm(
  tenantId: string | undefined,
  target: FormTargetType,
) {
  return useQuery({
    queryKey: tenantFormKeys.byTarget(tenantId ?? "", target),
    queryFn: async () => {
      try {
        return await apiGet<TenantForm>(tenantFormByTargetPath(target));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useCreateTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TenantFormCreateInput) =>
      apiPost<TenantForm>(tenantFormCreatePath(), input),
    onSuccess: (form) => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}

/**
 * PATCH bumps the version: backend creates a new version row, sets the old
 * one to `superseded`, and returns the new active row.
 */
export function useUpdateTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { formId: string } & TenantFormUpdateInput) => {
      const { formId, ...patch } = args;
      return apiPatch<TenantForm>(tenantFormDetailPath(formId), patch);
    },
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}

export function useArchiveTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      apiPost<TenantForm>(tenantFormArchivePath(formId)),
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}

export function useCloneTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      apiPost<TenantForm>(tenantFormClonePath(formId)),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
      }
    },
  });
}
