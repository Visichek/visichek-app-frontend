'use client';

/**
 * Visitor-adjacent hooks still needed by the app after the check-in
 * rewrite. The old staged-flow hooks (register, confirm, deny,
 * apply-id-scan, verify-id-scan, pending sessions, update-draft-session,
 * host-approve) have been removed — use src/features/checkins instead.
 *
 * What remains here is read-only history, check-out, and the QR mint
 * used by /app/visitors/qr.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/request';
import type {
  VisitSession,
  VisitorProfile,
  CheckOutRequest,
} from '@/types/visitor';
import type {
  MintRegistrationQrRequest,
  MintRegistrationQrResponse,
} from '@/types/public';

/**
 * Normalize backend session shape: maps `id` -> `id`, `checkInTime` -> `checkedInAt`,
 * `checkOutTime` -> `checkedOutAt` so the UI can rely on a single canonical shape.
 */
function normalizeSession(raw: unknown): VisitSession {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ...(r as object),
    id: (r.id ?? r.id ?? r._id ?? '') as string,
    checkedInAt: (r.checkedInAt ?? r.checkInTime ?? r.dateCreated) as number,
    checkedOutAt: (r.checkedOutAt ?? r.checkOutTime) as number | undefined,
  } as VisitSession;
}

/**
 * Query key factory for the surviving visitor-adjacent queries.
 */
const visitorKeys = {
  all: ['visitors'] as const,
  active: ['visitors', 'active'] as const,
  activeWithDept: (departmentId: string | undefined) =>
    ['visitors', 'active', departmentId] as const,
  sessions: ['visitors', 'sessions'] as const,
  sessionsList: (params: {
    start?: number;
    stop?: number;
    departmentId?: string;
  }) => ['visitors', 'sessions', params] as const,
  session: (sessionId: string) => ['visitors', 'sessions', sessionId] as const,
  badge: (sessionId: string) => ['visitors', 'sessions', sessionId, 'badge'] as const,
  profiles: ['visitor-profiles'] as const,
  profilesSearch: (query: string) =>
    ['visitor-profiles', 'search', query] as const,
};

/**
 * Fetch active visitors, optionally filtered by department.
 * Auto-refreshes every 5 seconds.
 */
export function useActiveVisitors(departmentId?: string) {
  return useQuery({
    queryKey: visitorKeys.activeWithDept(departmentId),
    queryFn: async () => {
      const data = await apiGet<VisitSession[]>('/visitors/active', {
        ...(departmentId && { departmentId: departmentId }),
      });
      return (data ?? []).map(normalizeSession);
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
}

/**
 * Fetch visitor sessions with pagination and optional department filtering.
 */
export function useVisitorSessions(params: {
  start?: number;
  stop?: number;
  departmentId?: string;
}) {
  return useQuery({
    queryKey: visitorKeys.sessionsList(params),
    queryFn: async () => {
      const data = await apiGet<VisitSession[]>('/visitors/sessions', params);
      return (data ?? []).map(normalizeSession);
    },
    enabled: true,
    staleTime: 30000,
  });
}

/**
 * Fetch a single visitor session by ID.
 */
export function useVisitorSession(sessionId: string) {
  return useQuery({
    queryKey: visitorKeys.session(sessionId),
    queryFn: async () => {
      const data = await apiGet<VisitSession>(
        `/visitors/sessions/${sessionId}`
      );
      return normalizeSession(data);
    },
    enabled: !!sessionId,
    staleTime: 30000,
  });
}

/**
 * Fetch visitor badge PDF (manual trigger).
 * Enabled is false by default, manually request when needed.
 */
export function useVisitorBadge(sessionId: string) {
  return useQuery({
    queryKey: visitorKeys.badge(sessionId),
    queryFn: async () => {
      const data = await apiGet<Blob>(
        `/visitors/sessions/${sessionId}/badge`
      );
      return data;
    },
    enabled: false,
  });
}

/**
 * Mutation for checking out a visitor.
 * Invalidates active visitors and sessions on success.
 */
export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CheckOutRequest) => {
      const data = await apiPost<VisitSession>(
        '/visitors/check-out',
        request
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.active });
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Check-in lists live under a different key — invalidate the whole
      // "checkins" namespace so the Visitors page refreshes.
      queryClient.invalidateQueries({ queryKey: ['checkins'] });
    },
  });
}

/**
 * Mint a registration QR token (receptionist / dept_admin / super_admin).
 */
export function useMintRegistrationQr() {
  return useMutation({
    mutationFn: (data: MintRegistrationQrRequest) =>
      apiPost<MintRegistrationQrResponse>('/visitors/registration-qr', data),
  });
}

/**
 * Search visitor profiles by query string.
 * Only enabled when query length >= 2.
 */
export function useSearchVisitorProfiles(query: string) {
  return useQuery({
    queryKey: visitorKeys.profilesSearch(query),
    queryFn: async () => {
      const data = await apiGet<VisitorProfile[]>(
        '/visitor-profiles/search',
        { q: query }
      );
      return data;
    },
    enabled: query.length >= 2,
    staleTime: 60000,
  });
}
