import type { SystemUserRole } from "@/types/enums";

/**
 * Map each tenant role to the routes it can access.
 * Used by sidebar navigation and route guards.
 */
export const ROLE_ROUTES: Record<SystemUserRole, string[]> = {
  super_admin: [
    "/app/dashboard",
    "/app/visitors",
    "/app/appointments",
    "/app/departments",
    "/app/branches",
    "/app/users",
    "/app/branding",
    "/app/incidents",
    "/app/audit",
    "/app/dpo",
    "/app/billing",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
  ],

  dept_admin: [
    "/app/dashboard",
    "/app/visitors",
    "/app/appointments",
    "/app/departments",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
  ],

  receptionist: [
    "/app/dashboard",
    "/app/visitors",
    "/app/appointments",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
  ],

  auditor: [
    "/app/audit",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
  ],

  security_officer: [
    "/app/incidents",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
  ],

  dpo: [
    "/app/dpo",
    "/app/audit",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
  ],
};

/**
 * Check if a role can access a given route.
 */
export function canAccessRoute(
  role: SystemUserRole,
  pathname: string
): boolean {
  const allowedRoutes = ROLE_ROUTES[role];
  if (!allowedRoutes) return false;
  return allowedRoutes.some((route) => pathname.startsWith(route));
}

/**
 * Get the default landing page for a role after login.
 */
export function getDefaultRoute(role: SystemUserRole): string {
  const routes = ROLE_ROUTES[role];
  return routes?.[0] ?? "/app/dashboard";
}
