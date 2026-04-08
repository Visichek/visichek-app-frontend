import axios from "axios";
import { getRefreshToken, getSessionType, setTokens, clearTokens } from "./tokens";
import type { TokenPair, SessionType } from "@/types/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

/** Refresh endpoint per session type */
const REFRESH_ENDPOINTS: Record<SessionType, string> = {
  admin: "/admins/refresh",
  system_user: "/system-users/refresh",
};

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
 * Refresh the current session. Returns the new access token on success.
 *
 * The httpOnly refresh cookie is sent automatically (withCredentials).
 * If we also have an in-memory refresh token, we include it in the body
 * as a belt-and-suspenders fallback.
 */
export async function refreshSession(): Promise<string> {
  const currentRefreshToken = getRefreshToken();
  const currentSessionType = getSessionType();

  if (!currentSessionType) {
    throw new Error("No session to refresh");
  }

  const endpoint = REFRESH_ENDPOINTS[currentSessionType];

  // Build request body — include refresh token if we have it in memory,
  // otherwise send empty body and let the cookie handle it.
  const body = currentRefreshToken
    ? { refreshToken: currentRefreshToken }
    : {};

  // Use a bare axios instance to avoid interceptor loops.
  const response = await axios.post<{ success: boolean; data: Record<string, unknown> }>(
    `${API_BASE_URL}${endpoint}`,
    body,
    { withCredentials: true }
  );

  const data = response.data.data ?? {};
  const newTokens = normalizeTokenPair(data);

  if (newTokens.accessToken) {
    setTokens(newTokens, currentSessionType);
  }

  return newTokens.accessToken;
}

/**
 * Clear the current session and redirect to the appropriate login page.
 */
export function clearSession(): void {
  const wasAdmin = getSessionType() === "admin";
  clearTokens();

  if (typeof window !== "undefined") {
    window.location.href = wasAdmin ? "/admin/login" : "/app/login";
  }
}
