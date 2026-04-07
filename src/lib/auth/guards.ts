import { isAuthenticated, isAdminSession, isSystemUserSession } from "./bootstrap";

/**
 * Route-level guard: requires any authenticated session.
 * Returns a redirect path if not authenticated, or null if OK.
 */
export function requireAuth(currentPath: string): string | null {
  if (!isAuthenticated()) {
    // Redirect to the appropriate login page based on the path
    if (currentPath.startsWith("/admin")) {
      return "/admin/login";
    }
    return "/app/login";
  }
  return null;
}

/**
 * Route-level guard: requires a platform admin session.
 */
export function requireAdmin(): string | null {
  if (!isAuthenticated()) return "/admin/login";
  if (!isAdminSession()) return "/app/login";
  return null;
}

/**
 * Route-level guard: requires a tenant system user session.
 */
export function requireSystemUser(): string | null {
  if (!isAuthenticated()) return "/app/login";
  if (!isSystemUserSession()) return "/admin/login";
  return null;
}
