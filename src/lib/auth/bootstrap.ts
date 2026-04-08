import { getAccessToken, getSessionType, clearTokens } from "./tokens";
import { apiGet } from "@/lib/api/request";
import { store } from "@/lib/store";
import {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
} from "@/lib/store/session-slice";
import type {
  AdminProfile,
  SystemUserProfile,
  SessionType,
} from "@/types/auth";

/** Profile endpoint per session type */
const ME_ENDPOINTS: Record<SessionType, string> = {
  admin: "/admins/profile",
  system_user: "/system-users/me",
};

/**
 * Attempt to rehydrate the session after a hard page refresh.
 *
 * Flow:
 * 1. Check sessionStorage for a persisted session type
 * 2. Call the /me or /profile endpoint — the httpOnly cookie is sent
 *    automatically via withCredentials, so no in-memory token is needed
 * 3. If the access token cookie is expired, the 401 interceptor will
 *    trigger a refresh using the refresh token cookie, then retry
 * 4. Populate the Redux store so the app knows we're authenticated
 * 5. If anything fails, clear everything — user lands on login naturally
 *
 * Returns true if the session was rehydrated, false otherwise.
 */
export async function bootstrapSession(): Promise<boolean> {
  const sessionType = getSessionType();

  if (!sessionType) {
    return false;
  }

  try {
    // Call the /me endpoint directly — the httpOnly cookie carries auth.
    // If the access token cookie is expired, the Axios 401 interceptor
    // will automatically refresh via the refresh token cookie and retry.
    const endpoint = ME_ENDPOINTS[sessionType];
    const data = await apiGet<Record<string, unknown>>(endpoint);

    if (sessionType === "admin") {
      const profile: AdminProfile = {
        id: (data.Id as string) ?? (data.id as string) ?? "",
        fullName: (data.fullName as string) ?? (data.full_name as string) ?? "",
        email: (data.email as string) ?? "",
      };

      store.dispatch(
        setAdminSession({
          type: "admin",
          tokens: { accessToken: "", refreshToken: "" },
          profile,
        })
      );
    } else {
      const profile: SystemUserProfile = {
        id: (data.id as string) ?? "",
        fullName: (data.fullName as string) ?? (data.full_name as string) ?? "",
        email: (data.email as string) ?? "",
        role: data.role as SystemUserProfile["role"],
        tenantId: (data.tenantId as string) ?? (data.tenant_id as string) ?? "",
        departmentId: (data.departmentId as string) ?? (data.department_id as string) ?? undefined,
      };

      store.dispatch(
        setSystemUserSession({
          type: "system_user",
          tokens: { accessToken: "", refreshToken: "" },
          profile,
        })
      );
    }

    return true;
  } catch {
    // Cookie expired or invalid — clear stale session type
    clearTokens();
    store.dispatch(clearSessionState());
    return false;
  }
}

/**
 * Check if the current session is still valid (in-memory).
 */
export function isAuthenticated(): boolean {
  return store.getState().session.isAuthenticated;
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
