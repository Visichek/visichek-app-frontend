import type { SessionType } from "@/types/auth";
import type { SystemUserRole } from "@/types/enums";
import { PATHS } from "./paths";
import { getDefaultRoute } from "@/lib/permissions/route-access";

/**
 * Get the login path for a session type.
 */
export function getLoginPath(type: SessionType): string {
  return type === "admin" ? PATHS.ADMIN_LOGIN : PATHS.APP_LOGIN;
}

/**
 * Get the post-login redirect path.
 */
export function getPostLoginPath(
  type: SessionType,
  role?: SystemUserRole
): string {
  if (type === "admin") return PATHS.ADMIN_DASHBOARD;
  if (role) return getDefaultRoute(role);
  return PATHS.APP_DASHBOARD;
}

/**
 * Route a user holding a server-generated temporary password to the
 * forced-change-password screen for their shell. Every other endpoint
 * returns 403 PASSWORD_CHANGE_REQUIRED until they post a real password,
 * so this is the only landing they can reach.
 */
export function getChangePasswordPath(type: SessionType): string {
  return type === "admin"
    ? PATHS.ADMIN_CHANGE_PASSWORD
    : PATHS.APP_CHANGE_PASSWORD;
}
