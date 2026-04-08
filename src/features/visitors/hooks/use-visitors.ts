'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api/request';
import type {
  VisitSession,
  VisitorProfile,
  CheckInRequest,
  CheckOutRequest,
  ConfirmCheckInRequest,
  ConfirmCheckInResponse,
  DenyVisitorRequest,
  ApplyIdScanRequest,
  UpdateDraftSessionRequest,
} from '@/types/visitor';

/**
 * Query key factory for visitor-related queries
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
  pending: ['visitors', 'sessions', 'pending'] as const,
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
      return data;
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
      return data;
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
      return data;
    },
    enabled: !!sessionId,
    staleTime: 30000,
  });
}

/**
 * Fetch pending visitor sessions (status REGISTERED or PENDING_VERIFICATION).
 * Auto-refreshes every 10 seconds.
 */
export function usePendingVisitorSessions() {
  return useQuery({
    queryKey: visitorKeys.pending,
    queryFn: async () => {
      const data = await apiGet<VisitSession[]>('/visitors/sessions/pending');
      return data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

/**
 * Mutation for checking in a visitor (initial registration).
 * Creates session with status=REGISTERED.
 * Invalidates active visitors and sessions on success.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CheckInRequest) => {
      const data = await apiPost<VisitSession>(
        '/visitors/check-in',
        request
      );
      return data;
    },
    onSuccess: (newSession) => {
      // Invalidate active visitors list
      queryClient.invalidateQueries({ queryKey: visitorKeys.active });
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
      // Optionally set the new session in the cache
      queryClient.setQueryData(
        visitorKeys.session(newSession.id),
        newSession
      );
    },
  });
}

/**
 * Mutation for confirming a visitor check-in.
 * Validates and generates badge, sets status=CHECKED_IN.
 * Invalidates sessions on success.
 */
export function useConfirmCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      badgeFormat,
    }: {
      sessionId: string;
    } & ConfirmCheckInRequest) => {
      const data = await apiPost<ConfirmCheckInResponse>(
        `/visitors/sessions/${sessionId}/confirm`,
        { badgeFormat }
      );
      return data;
    },
    onSuccess: (response, { sessionId }) => {
      // Update the session in cache
      queryClient.setQueryData(
        visitorKeys.session(sessionId),
        response.session
      );
      // Invalidate active visitors list
      queryClient.invalidateQueries({ queryKey: visitorKeys.active });
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
    },
  });
}

/**
 * Mutation for denying a visitor.
 * Sets status=DENIED with reason.
 * Invalidates sessions on success.
 */
export function useDenyVisitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      reason,
    }: {
      sessionId: string;
    } & DenyVisitorRequest) => {
      const data = await apiPost<VisitSession>(
        `/visitors/sessions/${sessionId}/deny`,
        { reason }
      );
      return data;
    },
    onSuccess: (updatedSession, { sessionId }) => {
      // Update the session in cache
      queryClient.setQueryData(
        visitorKeys.session(sessionId),
        updatedSession
      );
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
    },
  });
}

/**
 * Mutation for requesting host approval.
 * Invalidates sessions on success.
 */
export function useHostApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const data = await apiPost<VisitSession>(
        `/visitors/sessions/${sessionId}/host-approve`,
        {}
      );
      return data;
    },
    onSuccess: (updatedSession, sessionId) => {
      // Update the session in cache
      queryClient.setQueryData(
        visitorKeys.session(sessionId),
        updatedSession
      );
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
    },
  });
}

/**
 * Mutation for applying ID scan results to a session.
 * Invalidates sessions on success.
 */
export function useApplyIdScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      idType,
      idNumber,
      idImageObjectKey,
    }: {
      sessionId: string;
    } & ApplyIdScanRequest) => {
      const data = await apiPost<VisitSession>(
        `/visitors/sessions/${sessionId}/apply-id-scan`,
        { idType, idNumber, idImageObjectKey }
      );
      return data;
    },
    onSuccess: (updatedSession, { sessionId }) => {
      // Update the session in cache
      queryClient.setQueryData(
        visitorKeys.session(sessionId),
        updatedSession
      );
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
    },
  });
}

/**
 * Mutation for verifying an ID scan.
 * Uploads ID image and extracts fields.
 */
export function useVerifyIdScan() {
  return useMutation({
    mutationFn: async (request: FormData) => {
      const data = await apiPost<Record<string, unknown>>(
        '/visitors/verify/id-scan',
        request
      );
      return data;
    },
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
 * Mutation for updating a draft visitor session.
 * Allows updating session fields before confirmation.
 * Invalidates sessions on success.
 */
export function useUpdateDraftSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      ...updateData
    }: {
      sessionId: string;
    } & UpdateDraftSessionRequest) => {
      const data = await apiPatch<VisitSession>(
        `/visitors/sessions/${sessionId}/update-draft`,
        updateData
      );
      return data;
    },
    onSuccess: (updatedSession, { sessionId }) => {
      // Update the session in cache
      queryClient.setQueryData(
        visitorKeys.session(sessionId),
        updatedSession
      );
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
    },
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
      // Invalidate active visitors list
      queryClient.invalidateQueries({ queryKey: visitorKeys.active });
      // Invalidate all sessions queries
      queryClient.invalidateQueries({ queryKey: visitorKeys.sessions });
      // Invalidate pending sessions
      queryClient.invalidateQueries({ queryKey: visitorKeys.pending });
    },
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
