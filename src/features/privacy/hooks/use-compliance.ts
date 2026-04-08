'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/request';
import type {
  ComplianceRegisterEntry,
  ConsentLogEntry,
  DeletionLogEntry,
  CreateRegisterEntryRequest,
} from '@/types/compliance';

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    skip?: number;
    limit?: number;
  };
}

interface ComplianceRegisterParams {
  skip?: number;
  limit?: number;
}

interface ConsentLogParams {
  startDate?: string;
  endDate?: string;
  skip?: number;
  limit?: number;
}

interface DeletionLogsParams {
  skip?: number;
  limit?: number;
}

/**
 * Query key factory for compliance-related queries
 */
const complianceKeys = {
  all: ['compliance'] as const,
  register: () => ['compliance', 'register'] as const,
  registerList: (params?: ComplianceRegisterParams) =>
    ['compliance', 'register', 'list', params] as const,
  consentLog: () => ['compliance', 'consent-log'] as const,
  consentLogList: (params?: ConsentLogParams) =>
    ['compliance', 'consent-log', 'list', params] as const,
  deletionLogs: () => ['compliance', 'deletion-logs'] as const,
  deletionLogsList: (params?: DeletionLogsParams) =>
    ['compliance', 'deletion-logs', 'list', params] as const,
  export: () => ['compliance', 'export'] as const,
};

/**
 * Fetch compliance register entries
 * DPO role required
 */
export function useComplianceRegister(params?: ComplianceRegisterParams) {
  return useQuery<PaginatedResponse<ComplianceRegisterEntry>>({
    queryKey: complianceKeys.registerList(params),
    queryFn: () =>
      apiGet<PaginatedResponse<ComplianceRegisterEntry>>(
        '/compliance/register',
        params
      ),
  });
}

/**
 * Create a new compliance register entry
 * DPO role required
 */
export function useCreateRegisterEntry() {
  const queryClient = useQueryClient();

  return useMutation<ComplianceRegisterEntry, Error, CreateRegisterEntryRequest>({
    mutationFn: (data) =>
      apiPost<ComplianceRegisterEntry>('/compliance/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: complianceKeys.register(),
      });
    },
  });
}

/**
 * Fetch deletion logs
 * DPO role required
 */
export function useDeletionLogs(params?: DeletionLogsParams) {
  return useQuery<PaginatedResponse<DeletionLogEntry>>({
    queryKey: complianceKeys.deletionLogsList(params),
    queryFn: () =>
      apiGet<PaginatedResponse<DeletionLogEntry>>(
        '/compliance/deletion-logs',
        params
      ),
  });
}

/**
 * Fetch consent log with optional date range and pagination
 * DPO role required
 */
export function useConsentLog(params?: ConsentLogParams) {
  return useQuery<PaginatedResponse<ConsentLogEntry>>({
    queryKey: complianceKeys.consentLogList(params),
    queryFn: () =>
      apiGet<PaginatedResponse<ConsentLogEntry>>(
        '/compliance/consent-log',
        params
      ),
  });
}

/**
 * Download compliance export as blob
 * DPO role required
 * Returns the raw response which can be used to trigger a download
 */
export function useComplianceExport() {
  return useMutation<Blob, Error, void>({
    mutationFn: async () => {
      const response = await fetch('/compliance/export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      return response.blob();
    },
  });
}
