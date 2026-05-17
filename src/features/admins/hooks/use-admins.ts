"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import type {
  Admin,
  AdminSignupRequest,
  UpdateAdminAccessPresetRequest,
} from "@/types/user";

/**
 * React Query key factory for the platform-admin "Manage admins" feature.
 * Keep these stable — page-level prefetch hydrates the same keys.
 */
export const adminAccountsKeys = {
  all: ["admin-accounts"] as const,
  list: () => ["admin-accounts", "list"] as const,
  detail: (adminId: string) =>
    ["admin-accounts", "detail", adminId] as const,
};

/**
 * Fetch every platform admin. The backend's list endpoint is
 * `GET /v1/admins/` and returns a plain `Admin[]` (no envelope) per
 * the new admin-management spec.
 */
export function useAdmins() {
  return useQuery<Admin[]>({
    queryKey: adminAccountsKeys.list(),
    queryFn: () => apiGet<Admin[]>("/admins/"),
    placeholderData: keepPreviousData,
  });
}

/**
 * POST /v1/admins/signup — invite a new platform admin.
 *
 * The backend now forces `mfa_enabled=true` on every invited admin and
 * dispatches an HTML welcome email containing the temp password the
 * inviter chose. The selected `accessPreset` is persisted on the
 * admin row and the matching `permissionList` slice is derived
 * server-side.
 */
export function useInviteAdmin() {
  const queryClient = useQueryClient();
  return useMutation<Admin, Error, AdminSignupRequest>({
    mutationFn: (data) => apiPost<Admin>("/admins/signup", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAccountsKeys.all });
    },
  });
}

/**
 * PATCH /v1/admins/{admin_id}/access-preset — re-scope an existing
 * admin to a different preset.
 *
 * The backend rejects with 403 if the target is the env-pinned primary
 * admin and the requested preset is anything other than
 * `all_controls`; surface that as a regular API error toast.
 */
export function useUpdateAdminAccessPreset(adminId: string) {
  const queryClient = useQueryClient();
  return useMutation<Admin, Error, UpdateAdminAccessPresetRequest>({
    mutationFn: (data) =>
      apiPatch<Admin>(`/admins/${adminId}/access-preset`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAccountsKeys.all });
      queryClient.invalidateQueries({
        queryKey: adminAccountsKeys.detail(adminId),
      });
    },
  });
}

/**
 * Fan-out helper for bulk preset changes. The backend exposes no
 * `POST /admins/bulk/access-preset` endpoint, so we issue per-admin
 * PATCH requests in parallel and aggregate the result so the caller
 * can show "N of M succeeded" feedback per CLAUDE.md's bulk-mutation
 * rule.
 */
export function useBulkUpdateAdminAccessPreset() {
  const queryClient = useQueryClient();
  return useMutation<
    { succeeded: string[]; failed: { id: string; error: string }[] },
    Error,
    { ids: string[]; accessPreset: UpdateAdminAccessPresetRequest["accessPreset"] }
  >({
    mutationFn: async ({ ids, accessPreset }) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiPatch<Admin>(`/admins/${id}/access-preset`, { accessPreset }),
        ),
      );
      const succeeded: string[] = [];
      const failed: { id: string; error: string }[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          succeeded.push(ids[i]);
        } else {
          const message =
            r.reason instanceof Error ? r.reason.message : "Unknown error";
          failed.push({ id: ids[i], error: message });
        }
      });
      return { succeeded, failed };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminAccountsKeys.all });
    },
  });
}
