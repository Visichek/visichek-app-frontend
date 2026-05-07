import axios from "axios";
import { store } from "@/lib/store";
import { clearSessionState } from "@/lib/store/session-slice";
import { clearBranding } from "@/lib/store/branding-slice";
import { clearUserLocation } from "@/lib/geolocation/user-location";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";

/** Unified, role-agnostic refresh endpoint. The backend reads the refresh
 *  cookie and rotates both auth cookies via Set-Cookie. */
const UNIFIED_REFRESH_ENDPOINT = "/auth/refresh";

/** Maximum number of times we attempt to refresh before giving up. */
const MAX_REFRESH_ATTEMPTS = 2;

/**
 * Refresh the current session.
 *
 * Tokens live in httpOnly cookies set by the backend; this call sends them
 * automatically via `withCredentials` and the backend rotates them in the
 * response's Set-Cookie headers. The frontend never sees a token, so this
 * function returns nothing — callers just retry the original request and
 * the rotated cookie travels with it.
 *
 * Retries up to `MAX_REFRESH_ATTEMPTS` times before throwing — transient
 * network blips or a single backend hiccup should not log the user out.
 */
export async function refreshSession(): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt++) {
    try {
      // Bare axios instance to avoid interceptor loops.
      await axios.post(
        `${API_BASE_URL}${UNIFIED_REFRESH_ENDPOINT}`,
        {},
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Token refresh failed");
}

/**
 * Clear the current session and redirect to the appropriate login page.
 *
 * Reads session type from Redux to decide which login page to land on.
 * Does NOT clear the auth cookies itself — those are set by the backend
 * and only the backend can clear them (via the logout endpoint or by the
 * `clearSession` flow inside the middleware on a hard auth failure).
 */
export function clearSession(): void {
  const wasAdmin = store.getState().session.type === "admin";

  store.dispatch(clearSessionState());
  store.dispatch(clearBranding());
  // Drop any cached browser coordinates — the next principal signed in on
  // this tab must not inherit the previous user's geofencing presence.
  clearUserLocation();

  if (typeof window !== "undefined") {
    window.location.href = wasAdmin ? "/admin/login" : "/app/login";
  }
}
