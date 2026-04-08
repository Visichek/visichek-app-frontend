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
      (raw.accessToken as string) ?? (raw.accessToken as string) ?? "",
    refreshToken:
      (raw.refreshToken as string) ?? (raw.refreshToken as string) ?? "",
  };
}

/**
 * Refresh the current session. Returns the new access token on success.
 * Called by the Axios 401 interceptor — do NOT call from components.
 */
export async function refreshSession(): Promise<string> {
  const currentRefreshToken = getRefreshToken();
  const currentSessionType = getSessionType();

  if (!currentRefreshToken || !currentSessionType) {
    throw new Error("No session to refresh");
  }

  const endpoint = REFRESH_ENDPOINTS[currentSessionType];

  // Use a bare axios instance to avoid interceptor loops
  const response = await axios.post<{ success: boolean; data: Record<string, unknown> }>(
    `${API_BASE_URL}${endpoint}`,
    { refreshToken: currentRefreshToken }
  );

  const newTokens = normalizeTokenPair(response.data.data);
  setTokens(newTokens, currentSessionType);

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
