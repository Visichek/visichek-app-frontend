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
      const data = await apiGet<SystemUser[]>('/v1/system-users/', filters);
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
      const data = await apiGet<SystemUserProfile>('/v1/system-users/me');
      return data;
    },
    staleTime: 60000,
  });
}

/**
 * Mutation for creating a system user (tenant staff).
 * Invalidates the users list on success.
 */
export function useCreateSystemUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SystemUserSignupRequest) => {
      const data = await apiPost<SystemUser>('/v1/system-users/signup', request);
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
        `/v1/system-users/${userId}`,
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
      await apiDelete(`/v1/system-users/${userId}`);
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
        '/v1/super-admin/admins/invite',
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
