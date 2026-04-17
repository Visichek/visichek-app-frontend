"use client";

/**
 * Admin hooks for managing a tenant's check-in configs.
 *
 * Gated by the CHECKIN_CONFIG_VIEW / CHECKIN_CONFIG_EDIT capabilities,
 * granted to super_admin and dept_admin.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/request";
import type { CheckinConfig } from "@/types/checkin";
import {
  checkinConfigAdminPath,
  checkinConfigsAdminCreatePath,
  checkinConfigsAdminListPath,
} from "../lib/endpoints";
import { checkinKeys } from "../lib/query-keys";

export type CheckinConfigCreateInput = Omit<
  CheckinConfig,
  "id" | "createdAt" | "updatedAt"
>;
export type CheckinConfigUpdateInput = Partial<CheckinConfigCreateInput>;

/** List all check-in configs for a tenant. */
export function useCheckinConfigs(tenantId: string | undefined) {
  return useQuery({
    queryKey: checkinKeys.configsList(tenantId ?? ""),
    queryFn: () =>
      apiGet<CheckinConfig[]>(checkinConfigsAdminListPath(tenantId!)),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/** Fetch a single config by id. */
export function useCheckinConfig(configId: string | undefined) {
  return useQuery({
    queryKey: checkinKeys.configDetail(configId ?? ""),
    queryFn: () =>
      apiGet<CheckinConfig>(checkinConfigAdminPath(configId!)),
    enabled: !!configId,
    staleTime: 30_000,
  });
}

/** Create a new config. */
export function useCreateCheckinConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckinConfigCreateInput) =>
      apiPost<CheckinConfig>(
        checkinConfigsAdminCreatePath(tenantId!),
        input
      ),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: checkinKeys.configsList(tenantId),
        });
      }
    },
  });
}

/** Update an existing config. Partial payload. */
export function useUpdateCheckinConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { configId: string } & CheckinConfigUpdateInput) => {
      const { configId, ...patch } = args;
      return apiPatch<CheckinConfig>(
        checkinConfigAdminPath(configId),
        patch
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        checkinKeys.configDetail(updated.id),
        updated
      );
      queryClient.invalidateQueries({
        queryKey: checkinKeys.configsList(updated.tenantId),
      });
    },
  });
}

/** Delete a config. */
export function useDeleteCheckinConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { configId: string; tenantId: string }) =>
      apiDelete<void>(checkinConfigAdminPath(args.configId)),
    onSuccess: (_void, { tenantId }) => {
      queryClient.invalidateQueries({
        queryKey: checkinKeys.configsList(tenantId),
      });
    },
  });
}
