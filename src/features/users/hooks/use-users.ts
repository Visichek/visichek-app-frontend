'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from '@/lib/api/request';
import type {
  SystemUser,
  SystemUserSignupRequest,
  SystemUserUpdateRequest,
  InviteAdminRequest,
  ResetUserPasswordRequest,
  ResetUserPasswordResponse,
} from '@/types/user';
import type { SystemUserProfile } from '@/types/auth';

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
 * Fetch all system users (tenant staff and super admin).
 */
export function useSystemUsers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const data = await apiGet<SystemUser[]>('/system-users', filters);
      return data;
    },
    staleTime: 30000,
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
