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
