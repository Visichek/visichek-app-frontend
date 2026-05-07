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

export function useChangePassword() {
  const basePath = useBasePath();
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      apiPost<ChangePasswordResponse>(`${basePath}/change-password`, data),
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
