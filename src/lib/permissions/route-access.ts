import type { SystemUserRole } from "@/types/enums";

/**
 * Map each tenant role to the routes it can access.
 * Used by sidebar navigation and route guards.
 */
export const ROLE_ROUTES: Record<SystemUserRole, string[]> = {
  super_admin: [
    "/app/dashboard",
    "/app/insights",
    "/app/visitors",
    "/app/appointments",
    "/app/departments",
    "/app/hosts",
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
    "/app/tutorials",
    "/app/onboarding",
  ],

  dept_admin: [
    "/app/dashboard",
    "/app/insights",
    "/app/visitors",
    "/app/appointments",
    "/app/departments",
    "/app/hosts",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
    "/app/tutorials",
  ],

  receptionist: [
    "/app/dashboard",
    "/app/insights",
    "/app/visitors",
    "/app/appointments",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
    "/app/tutorials",
  ],

  auditor: [
    "/app/audit",
    "/app/insights",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
    "/app/tutorials",
  ],

  security_officer: [
    "/app/incidents",
    "/app/insights",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
    "/app/tutorials",
  ],

  dpo: [
    "/app/dpo",
    "/app/insights",
    "/app/audit",
    "/app/alerts",
    "/app/support-cases",
    "/app/jobs",
    "/app/settings",
    "/app/tutorials",
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
