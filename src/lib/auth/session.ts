import axios from "axios";
import { getAccessToken, getRefreshToken, getSessionType, setTokens, clearTokens } from "./tokens";
import { clearUserLocation } from "@/lib/geolocation/user-location";
import type { TokenPair, SessionType } from "@/types/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";

/** Unified, role-agnostic refresh endpoint. The backend dispatches by role
 *  using the (possibly expired) access token in the Authorization header. */
const UNIFIED_REFRESH_ENDPOINT = "/auth/refresh";

/** Tenant roles mapped to the `system_user` session type. */
const TENANT_ROLES = new Set([
  "super_admin",
  "dept_admin",
  "receptionist",
  "auditor",
  "security_officer",
  "dpo",
]);

/**
 * Normalize a token response that may use camelCase or snake_case keys.
 */
function normalizeTokenPair(raw: Record<string, unknown>): TokenPair {
  return {
    accessToken:
      (raw.accessToken as string) ?? (raw.access_token as string) ?? "",
    refreshToken:
      (raw.refreshToken as string) ?? (raw.refresh_token as string) ?? "",
  };
}

/**
 * Derive a session type from the role returned by the unified refresh
 * endpoint. Falls back to the current session type if the role is missing
 * or unrecognised.
 */
function deriveSessionType(
  role: unknown,
  fallback: SessionType | null
): SessionType | null {
  if (typeof role === "string") {
    if (role === "admin") return "admin";
    if (TENANT_ROLES.has(role)) return "system_user";
    // `user` (regular application user) — not currently a shell, fall through.
  }
  return fallback;
}

/** Maximum number of times we attempt to refresh before giving up. */
const MAX_REFRESH_ATTEMPTS = 2;

/**
 * Refresh the current session. Returns the new access token on success.
 *
 * Uses the unified `POST /v1/auth/refresh` endpoint, which auto-detects the
 * caller's role from the (possibly expired) access token. The httpOnly
 * refresh cookie is sent automatically (withCredentials); if we also have an
 * in-memory refresh token, we include it in the body as a fallback.
 *
 * Retries up to `MAX_REFRESH_ATTEMPTS` times before throwing — transient
 * network blips or a single backend hiccup should not log the user out.
 */
export async function refreshSession(): Promise<string> {
  const currentSessionType = getSessionType();

  if (!currentSessionType) {
    throw new Error("No session to refresh");
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt++) {
    try {
      // Re-read tokens on each attempt — a parallel refresh may have updated them.
      const currentRefreshToken = getRefreshToken();
      // The backend requires the expired access token in the Authorization header
      // to locate the token record — it decodes it without expiry validation.
      const expiredAccessToken = getAccessToken();

      const body = currentRefreshToken
        ? { refreshToken: currentRefreshToken }
        : {};

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (expiredAccessToken) {
        headers.Authorization = `Bearer ${expiredAccessToken}`;
      }

      // Use a bare axios instance to avoid interceptor loops.
      const response = await axios.post<{ success: boolean; data: Record<string, unknown> }>(
        `${API_BASE_URL}${UNIFIED_REFRESH_ENDPOINT}`,
        body,
        { withCredentials: true, headers }
      );

      const data = response.data.data ?? {};
      const newTokens = normalizeTokenPair(data);
      const nextSessionType = deriveSessionType(data.role, currentSessionType);

      if (newTokens.accessToken && nextSessionType) {
        setTokens(newTokens, nextSessionType);
      }

      return newTokens.accessToken;
    } catch (err) {
      lastError = err;
      // Fall through and try again unless this was the final attempt.
    }
  }

  throw lastError ?? new Error("Token refresh failed");
}

/**
 * Clear the current session and redirect to the appropriate login page.
 */
export function clearSession(): void {
  const wasAdmin = getSessionType() === "admin";
  clearTokens();
  // Drop any cached browser coordinates — the next principal signed in on
  // this tab must not inherit the previous user's geofencing presence.
  clearUserLocation();

  if (typeof window !== "undefined") {
    window.location.href = wasAdmin ? "/admin/login" : "/app/login";
  }
}
