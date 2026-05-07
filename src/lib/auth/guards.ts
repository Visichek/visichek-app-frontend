import { store } from "@/lib/store";
import { PATHS } from "@/lib/routing/paths";

/**
 * Non-React route guards.
 *
 * Reads from the Redux session slice, which is hydrated from `GET /me`
 * during bootstrap. For React components, prefer the `useSession()` hook
 * — these helpers exist for non-React code paths (e.g. imperative
 * navigation handlers) that still need to know shell membership.
 *
 * Returns the redirect path if the guard fails, or `null` if it passes.
 */

function getSession() {
  return store.getState().session;
}

export function requireAuth(currentPath: string): string | null {
  if (getSession().isAuthenticated) return null;
  return currentPath.startsWith("/admin")
    ? PATHS.ADMIN_LOGIN
    : PATHS.APP_LOGIN;
}

export function requireAdmin(): string | null {
  const session = getSession();
  if (!session.isAuthenticated) return PATHS.ADMIN_LOGIN;
  if (session.type !== "admin") return PATHS.APP_LOGIN;
  return null;
}

export function requireSystemUser(): string | null {
  const session = getSession();
  if (!session.isAuthenticated) return PATHS.APP_LOGIN;
  if (session.type !== "system_user") return PATHS.ADMIN_LOGIN;
  return null;
}
