"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api/request";
import { useAppSelector } from "@/lib/store/hooks";
import { selectSessionType } from "@/lib/store/session-slice";
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
  TwoFactorVerifyResponse,
  TwoFactorDisableRequest,
  TwoFactorDisableResponse,
  BackupCodesResponse,
  SessionOut,
  RevokeSessionResponse,
  RevokeAllSessionsResponse,
  BulkRevokeSessionsResult,
} from "@/types/account";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Read the current session's base path from Redux. The session is
 * hydrated from `GET /me` on boot — components calling these hooks are
 * always inside an authenticated shell, so `sessionType` will be set.
 */
function useBasePath(): string {
  const sessionType = useAppSelector(selectSessionType);
  return sessionType === "admin" ? "/admins" : "/system-users";
}

// ── Query Keys ───────────────────────────────────────────────────────

export const accountKeys = {
  sessions: ["account", "sessions"] as const,
  twoFactor: ["account", "2fa"] as const,
};

// ── Password Change ──────────────────────────────────────────────────

/**
 * Submit a new password via the unified change-password endpoint.
 *
 * `POST /v1/auth/change-password` accepts both admin and system-user
 * sessions and is on the allowlist while `mustChangePassword=true`, so
 * it works as the "first sign-in" flow for newly-invited / authority-
 * reset accounts as well as the regular settings flow.
 *
 * The role-specific paths (`/admins/change-password`,
 * `/system-users/change-password`) are still on the allowlist server-
 * side and are kept here as a fallback for older deployments.
 */
export function useChangePassword() {
  const basePath = useBasePath();
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      try {
        return await apiPost<ChangePasswordResponse>(
          "/auth/change-password",
          data,
        );
      } catch (err) {
        // Fallback to the role-scoped endpoint if the unified path is
        // not deployed (older backends). Both share the same body shape.
        return apiPost<ChangePasswordResponse>(
          `${basePath}/change-password`,
          data,
        );
      }
    },
  });
}

// ── 2FA Setup ────────────────────────────────────────────────────────

export function useSetup2FA() {
  const basePath = useBasePath();
  return useMutation({
    mutationFn: () =>
      apiPost<TwoFactorSetupResponse>(`${basePath}/2fa/setup`),
  });
}

export function useVerify2FA() {
  const basePath = useBasePath();
  return useMutation({
    mutationFn: (data: TwoFactorVerifyRequest) =>
      apiPost<TwoFactorVerifyResponse>(`${basePath}/2fa/verify`, data),
  });
}

export function useDisable2FA() {
  const basePath = useBasePath();
  return useMutation({
    mutationFn: (data: TwoFactorDisableRequest) =>
      apiPost<TwoFactorDisableResponse>(`${basePath}/2fa/disable`, data),
  });
}

export function useRegenerateBackupCodes() {
  const basePath = useBasePath();
  return useMutation({
    mutationFn: () =>
      apiPost<BackupCodesResponse>(`${basePath}/2fa/backup-codes`),
  });
}

// ── Session Management ───────────────────────────────────────────────

export function useSessions() {
  const basePath = useBasePath();
  return useQuery({
    queryKey: accountKeys.sessions,
    queryFn: () => apiGet<SessionOut[]>(`${basePath}/sessions`),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  const basePath = useBasePath();

  return useMutation({
    mutationFn: (sessionId: string) =>
      apiDelete<RevokeSessionResponse>(
        `${basePath}/sessions/${sessionId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.sessions });
    },
  });
}

/**
 * Revoke a selected set of sessions. The backend only exposes
 * revoke-one and revoke-all, so a partial selection fans out to
 * per-session DELETEs and aggregates the outcome — callers surface
 * "X of Y revoked" instead of failing silently on partial errors.
 */
export function useRevokeSessions() {
  const queryClient = useQueryClient();
  const basePath = useBasePath();

  return useMutation({
    mutationFn: async (
      sessionIds: string[]
    ): Promise<BulkRevokeSessionsResult> => {
      const results = await Promise.allSettled(
        sessionIds.map((id) =>
          apiDelete<RevokeSessionResponse>(`${basePath}/sessions/${id}`)
        )
      );
      const succeeded: string[] = [];
      const failed: string[] = [];
      results.forEach((result, index) => {
        (result.status === "fulfilled" ? succeeded : failed).push(
          sessionIds[index]
        );
      });
      return { succeeded, failed };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.sessions });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  const basePath = useBasePath();

  return useMutation({
    mutationFn: () =>
      apiDelete<RevokeAllSessionsResponse>(`${basePath}/sessions`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.sessions });
    },
  });
}
