import axios from "axios";
import { store } from "@/lib/store";
import { clearSessionState } from "@/lib/store/session-slice";
import { clearBranding } from "@/lib/store/branding-slice";
import { clearUserLocation } from "@/lib/geolocation/user-location";
import { isLogoutTransitionActive } from "@/lib/auth/auth-transition";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";

/** Unified, role-agnostic refresh endpoint. The backend reads the refresh
 *  cookie and rotates both auth cookies via Set-Cookie. */
const UNIFIED_REFRESH_ENDPOINT = "/auth/refresh";

/** Maximum number of times we attempt to refresh before giving up.
 *  Three is enough to ride out a transient network blip without dragging
 *  a real outage out forever — combined with the per-attempt timeout the
 *  ceiling is bounded at MAX_REFRESH_ATTEMPTS * REFRESH_REQUEST_TIMEOUT_MS. */
const MAX_REFRESH_ATTEMPTS = 3;

/** Per-attempt timeout for the refresh call. Bare axios defaults to no
 *  timeout, which means a stalled refresh endpoint hangs the whole boot
 *  flow forever (the spinner in `Providers` never clears). 5s is generous
 *  for a healthy backend and short enough that a sick one fails fast. */
const REFRESH_REQUEST_TIMEOUT_MS = 5_000;

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
          timeout: REFRESH_REQUEST_TIMEOUT_MS,
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

  if (typeof window === "undefined") return;

  // Explicit logout owns its own final redirect. In-flight requests may
  // still fail with 401 while the backend is clearing cookies; do not let
  // those failures race the logout flow and bounce through dashboard/login.
  if (isLogoutTransitionActive()) return;

  // If bootstrap is still in flight (e.g., a /me probe just 401'd and the
  // refresh failed), do NOT fire a hard navigation here. BootstrapGate is
  // still showing the spinner, and once bootstrap settles, AuthGuard will
  // soft-redirect via router.replace. A window.location.href mid-bootstrap
  // causes a full reload that re-runs the same failing flow on the new
  // page — the source of the "login/logout loop" on unauthorized access.
  if (store.getState().session.isBootstrapping) return;

  const currentPath = window.location.pathname;

  // If the user is already on a login page (or any public path that
  // doesn't need a session), do nothing. A hard navigation here would
  // reload the page, re-run bootstrap, hit /me → 401 → refresh → fail →
  // clearSession → reload again, producing an infinite refresh loop.
  // Redux is already cleared, which is all this call needs to do.
  if (
    currentPath === "/admin/login" ||
    currentPath === "/app/login" ||
    currentPath === "/" ||
    currentPath.startsWith("/register") ||
    currentPath.startsWith("/checkout") ||
    currentPath.startsWith("/rights") ||
    currentPath.startsWith("/support") ||
    currentPath.startsWith("/app/scan") ||
    currentPath.startsWith("/app/select-tenant") ||
    currentPath.startsWith("/app/select-organization")
  ) {
    return;
  }

  // When we have no prior session type to read (e.g. boot-time refresh
  // failure), pick the login page that matches the current path's shell
  // rather than always falling back to /app/login.
  const target = wasAdmin
    ? "/admin/login"
    : currentPath.startsWith("/admin")
      ? "/admin/login"
      : "/app/login";

  window.location.href = target;
}
