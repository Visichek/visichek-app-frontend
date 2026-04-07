import type { SessionType, TokenPair } from "@/types/auth";

/**
 * In-memory token store.
 * Tokens are NEVER persisted to localStorage, sessionStorage, or cookies.
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionType: SessionType | null = null;

export function setTokens(tokens: TokenPair, type: SessionType): void {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  sessionType = type;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function getSessionType(): SessionType | null {
  return sessionType;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  sessionType = null;
}
