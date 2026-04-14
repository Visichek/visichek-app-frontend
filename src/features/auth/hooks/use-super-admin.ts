'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api/request';
import type { VisitSession } from '@/types/visitor';

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    skip?: number;
    limit?: number;
  };
}

interface VisitSessionLogParams {
  startDate?: string;
  endDate?: string;
  statusFilter?: string;
  skip?: number;
  limit?: number;
}

interface GenerateRegistrationQRResponse {
  qr_code: string;
  expiresIn?: number;
}

interface AssignUserDepartmentRequest {
  userId: string;
  departmentId: string;
}

interface SuperAdminAnalyticsResponse {
  total_visitors?: number;
  active_visitors?: number;
  checked_in_today?: number;
  total_appointments?: number;
  fulfilled_appointments?: number;
  pending_dsr?: number;
  open_incidents?: number;
  [key: string]: unknown;
}

/**
 * Query key factory for super-admin-specific queries
 */
const superAdminKeys = {
  all: ['super-admin'] as const,
  visitorLog: () => ['super-admin', 'visitor-log'] as const,
  visitorLogList: (params?: VisitSessionLogParams) =>
    ['super-admin', 'visitor-log', 'list', params] as const,
  analytics: () => ['super-admin', 'analytics'] as const,
};

/**
 * Fetch visitor log with optional date range, status filter, and pagination
 * Super admin role required
 */
export function useVisitSessionLog(params?: VisitSessionLogParams) {
  return useQuery<PaginatedResponse<VisitSession>>({
    queryKey: superAdminKeys.visitorLogList(params),
    queryFn: () =>
      apiGet<PaginatedResponse<VisitSession>>(
        '/super-admin/visitor-log',
        params
      ),
  });
}

/**
 * Generate a new registration QR code
 * Super admin role required
 */
export function useGenerateRegistrationQR() {
  return useMutation<GenerateRegistrationQRResponse, Error, void>({
    mutationFn: () =>
      apiPost<GenerateRegistrationQRResponse>(
        '/super-admin/registration-qr',
        {}
      ),
  });
}

/**
 * Assign a user to a department
 * Super admin role required
 * Updates user's department affiliation
 */
export function useAssignUserDepartment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, AssignUserDepartmentRequest>({
    mutationFn: ({ userId, departmentId }) =>
      apiPatch<void>(
        `/super-admin/admins/${userId}/department`,
        { departmentId: departmentId }
      ),
    onSuccess: () => {
      // Invalidate related user and department queries
      queryClient.invalidateQueries({
        queryKey: ['users'],
      });
      queryClient.invalidateQueries({
        queryKey: ['departments'],
      });
    },
  });
}

/**
 * Fetch super admin analytics and statistics
 * Super admin role required
 * Returns aggregated metrics about the tenant
 */
export function useSuperAdminAnalytics() {
  return useQuery<SuperAdminAnalyticsResponse>({
    queryKey: superAdminKeys.analytics(),
    queryFn: () =>
      apiGet<SuperAdminAnalyticsResponse>('/super-admin/analytics'),
    staleTime: 300000, // 5 minutes
  });
}
