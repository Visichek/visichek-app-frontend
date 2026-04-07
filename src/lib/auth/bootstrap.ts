import { getAccessToken, getSessionType } from "./tokens";

/**
 * Check if the current session is still valid.
 * Called on app init to determine if the user is authenticated.
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Check if the current session is a platform admin session.
 */
export function isAdminSession(): boolean {
  return getSessionType() === "admin";
}

/**
 * Check if the current session is a tenant system user session.
 */
export function isSystemUserSession(): boolean {
  return getSessionType() === "system_user";
}
