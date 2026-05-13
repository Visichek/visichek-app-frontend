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
import { POLLING_INTERVALS, pollWhenAuthenticated } from '@/lib/query/polling';
import type {
  VisitSession,
  VisitorProfile,
  CheckOutRequest,
  CheckoutResult,
  AwaitingCheckoutItem,
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
    id: (r.id ?? r._id ?? '') as string,
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
  awaitingCheckout: ['visitors', 'awaiting-checkout'] as const,
  awaitingCheckoutList: (params: {
    departmentId?: string;
    start?: number;
    stop?: number;
  }) => ['visitors', 'awaiting-checkout', params] as const,
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
    refetchInterval: () =>
      pollWhenAuthenticated(POLLING_INTERVALS.activeVisitors),
    refetchIntervalInBackground: false,
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
 * Fetch the unified picker for `GET /v1/visitors/awaiting-checkout`.
 *
 * Returns the merged stream of three independently sourced collections
 * (visit_session, approved_checkin, scheduled_appointment) as
 * AwaitingCheckoutItem rows, sorted newest-eligible first by the server.
 * Field availability per row varies by `sourceType` — see the type doc.
 *
 * Auto-refreshes every 5 seconds so concurrent checkouts from other
 * receptionists drop out of the list quickly.
 */
export function useAwaitingCheckout(params?: {
  departmentId?: string;
  start?: number;
  stop?: number;
}) {
  const normalized = {
    departmentId: params?.departmentId,
    start: params?.start,
    stop: params?.stop,
  };
  return useQuery({
    queryKey: visitorKeys.awaitingCheckoutList(normalized),
    queryFn: async () => {
      const data = await apiGet<AwaitingCheckoutItem[]>(
        '/visitors/awaiting-checkout',
        {
          ...(normalized.departmentId && {
            departmentId: normalized.departmentId,
          }),
          ...(normalized.start !== undefined && { start: normalized.start }),
          ...(normalized.stop !== undefined && { stop: normalized.stop }),
        },
      );
      return data ?? [];
    },
    refetchInterval: () =>
      pollWhenAuthenticated(POLLING_INTERVALS.awaitingCheckout),
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });
}

/**
 * Mutation for `POST /v1/visitors/check-out`.
 *
 * Two normal call shapes:
 *  - From the awaiting-checkout picker: pass `{ sourceType, checkoutId }`
 *    straight off the row (optionally `checkOutMethod: "manual"`).
 *  - From a badge scan: pass `{ badgeQrToken, checkOutMethod: "qr_scan" }`
 *    and let the server resolve the underlying record.
 *
 * Returns a unified `CheckoutResult` for all three source types — the
 * server pre-computes `actualDurationSeconds`, `actualDurationMinutes`,
 * and (when an expected duration was set) `durationVarianceSeconds`, so
 * the UI never subtracts timestamps itself.
 */
export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CheckOutRequest) => {
      const data = await apiPost<CheckoutResult>(
        '/visitors/check-out',
        request
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitorKeys.active });
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      queryClient.invalidateQueries({ queryKey: visitorKeys.awaitingCheckout });
      // Approved-checkin and scheduled-appointment terminal states live
      // under different query namespaces, so blow them all away — the
      // awaiting-checkout payload draws from all three collections.
      queryClient.invalidateQueries({ queryKey: ['checkins'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
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
