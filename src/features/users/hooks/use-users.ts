'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from '@/lib/api/request';
import { apiGetList } from '@/lib/api/list';
import { bulkAction } from '@/lib/api/bulk';
import type {
  SystemUser,
  SystemUserSignupRequest,
  SystemUserUpdateRequest,
  InviteAdminRequest,
  ResetUserPasswordRequest,
  ResetUserPasswordResponse,
  InitiateTransferMainSuperAdminRequest,
  InitiateTransferMainSuperAdminResponse,
  CompleteTransferMainSuperAdminRequest,
} from '@/types/user';
import type { SystemUserProfile } from '@/types/auth';
import type { ListResponse, BulkJobResult } from '@/types/list';

/**
 * Query key factory for user-related queries
 */
const userKeys = {
  all: ['users'] as const,
  lists: () => ['users', 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    ['users', 'list', filters] as const,
  details: () => ['users', 'detail'] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  current: () => ['users', 'current'] as const,
};

/**
 * Fetch the paginated system-users list. Returns the new `{ items, meta }`
 * envelope per tables.txt §2.1.
 */
export function useSystemUsers(filters?: Record<string, unknown>) {
  return useQuery<ListResponse<SystemUser>>({
    queryKey: userKeys.list(filters),
    queryFn: () => apiGetList<SystemUser>('/system-users', filters),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch the current authenticated user profile.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.current(),
    queryFn: async () => {
      const data = await apiGet<SystemUserProfile>('/system-users/me');
      return data;
    },
    staleTime: 60000,
  });
}

/**
 * Invite a new system user (tenant staff or super_admin).
 *
 * Hits POST /v1/system-users/invite (the queued-write invite endpoint —
 * apiPost auto-polls the 202 response).
 *
 * Branch rules:
 * - branchIds is OPTIONAL. If omitted/empty the server defaults to the
 *   tenant's HQ branch.
 * - If branchIds.length > 1 the plan's max_branches must allow it; the
 *   server returns 403 otherwise.
 */
export function useCreateSystemUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SystemUserSignupRequest) => {
      const data = await apiPost<SystemUser>('/system-users/invite', request);
      return data;
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.setQueryData(userKeys.detail(newUser.id), newUser);
    },
  });
}

/**
 * Mutation for updating a system user.
 * Invalidates the users list and the specific user on success.
 */
export function useUpdateSystemUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: SystemUserUpdateRequest;
    }) => {
      const result = await apiPatch<SystemUser>(
        `/system-users/${userId}`,
        data
      );
      return result;
    },
    onSuccess: (updatedUser) => {
      // Invalidate all users lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      // Update the specific user in cache
      queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
    },
  });
}

/**
 * Mutation for deleting a system user.
 * Invalidates the users list on success.
 */
export function useDeleteSystemUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await apiDelete(`/system-users/${userId}`);
    },
    onSuccess: (_, userId) => {
      // Invalidate all users lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      // Remove the deleted user from cache
      queryClient.removeQueries({
        queryKey: userKeys.detail(userId),
      });
    },
  });
}

/**
 * Bulk delete / deactivate / reset-password via a single queued job per
 * tables.txt §2.1. Backend enforces self-protect + super_admin protect
 * server-side; protected ids land in `failed[]` with code USER_DELETE_PROTECTED
 * or USER_DEACTIVATE_PROTECTED. The frontend pre-filters as a UX shortcut.
 */
export function useBulkSystemUserAction(
  action: "delete" | "deactivate" | "reset-password"
) {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult, Error, { ids: string[]; atomic?: boolean }>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction(`/system-users/bulk/${action}`, ids, { atomic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Mutation for inviting an admin user.
 * This is an alternate flow for inviting new system users (admins).
 */
export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: InviteAdminRequest) => {
      const data = await apiPost<SystemUser>(
        '/super-admin/admins/invite',
        request
      );
      return data;
    },
    onSuccess: (newUser) => {
      // Invalidate all users lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      // Optionally cache the new user
      queryClient.setQueryData(userKeys.detail(newUser.id), newUser);
    },
  });
}

/**
 * Reset another tenant user's password (super_admin path).
 *
 * Hits POST /v1/system-users/{user_id}/reset-password. Target must be in
 * the SAME tenant as the caller — cross-tenant attempts return 404.
 *
 * Side effects on the server:
 * - Validates against password policy + last-5 history.
 * - Updates password_hash and revokes ALL active access + refresh tokens
 *   for the target — they will be logged out of every active session.
 * - Writes a `system_user.password_reset` audit row.
 *
 * Errors the FE must handle:
 * - 400 VALIDATION_FAILED: actor tried to reset their own password
 *   through this path → redirect them to the self-service change-password
 *   screen.
 * - 404 RESOURCE_NOT_FOUND: user not in this tenant — show a generic
 *   message; do NOT leak cross-tenant existence.
 * - 422 VALIDATION_FAILED: policy / history failure — surface inline
 *   against the password input.
 */
/**
 * Step 1 of the two-step main super_admin transfer flow. Triggers an OTP
 * delivered to the actor's configured 2FA channel and returns the
 * `otpChallengeId` to bind the verify call to.
 *
 * The hook does NOT invalidate the users list — the rotation only takes
 * effect after step 2 (verify) succeeds.
 */
export function useInitiateTransferMainSuperAdmin() {
  return useMutation({
    mutationFn: async (request: InitiateTransferMainSuperAdminRequest) => {
      const data = await apiPost<InitiateTransferMainSuperAdminResponse>(
        '/system-users/transfer-main-super-admin/initiate',
        request,
      );
      return data;
    },
  });
}

/**
 * Step 2 of the main super_admin transfer flow. The body MUST echo the
 * `newMainSuperAdminUserId` + `tenantId` returned by step 1 — the server
 * checks both against the OTP intent and rejects with
 * `OTP_TARGET_MISMATCH` if they diverge.
 *
 * On success, invalidates the users list so the `isMainSuperAdmin` flag
 * flips on both rows without a manual refetch.
 */
export function useCompleteTransferMainSuperAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CompleteTransferMainSuperAdminRequest) => {
      const data = await apiPost<SystemUser>(
        '/system-users/transfer-main-super-admin',
        request,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useResetUserPassword() {
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
        `/system-users/${userId}/reset-password`,
        body
      );
      return data;
    },
  });
}
