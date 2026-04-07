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
  ],

  dept_admin: [
    "/app/dashboard",
    "/app/visitors",
    "/app/appointments",
    "/app/departments",
  ],

  receptionist: [
    "/app/dashboard",
    "/app/visitors",
    "/app/appointments",
  ],

  auditor: [
    "/app/audit",
  ],

  security_officer: [
    "/app/incidents",
  ],

  dpo: [
    "/app/dpo",
    "/app/audit",
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
