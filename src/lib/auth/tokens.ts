import type { SessionType, TokenPair } from "@/types/auth";

/**
 * In-memory token store.
 *
 * Primary auth mechanism: httpOnly cookies set by the backend.
 * The in-memory tokens serve as a fallback for the Authorization
 * header on the same page load (before a refresh clears them).
 *
 * We persist only `sessionType` to sessionStorage so bootstrap
 * knows which /me endpoint to call after a hard page refresh.
 * Actual auth tokens live in httpOnly cookies managed by the backend.
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionType: SessionType | null = null;

const SESSION_TYPE_KEY = "visichek_session_type";

export function setTokens(tokens: TokenPair, type: SessionType): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  sessionType = type;

  try {
    sessionStorage.setItem(SESSION_TYPE_KEY, type);
  } catch {
    // SSR or private browsing — ignore
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function getSessionType(): SessionType | null {
  if (sessionType) return sessionType;

  // Fall back to sessionStorage (survives hard refresh)
  try {
    const stored = sessionStorage.getItem(SESSION_TYPE_KEY);
    if (stored === "admin" || stored === "system_user") {
      sessionType = stored;
      return stored;
    }
  } catch {
    // SSR or private browsing
  }

  return null;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  sessionType = null;

  try {
    sessionStorage.removeItem(SESSION_TYPE_KEY);
  } catch {
    // SSR or private browsing
  }
}
