import { apiGet } from "@/lib/api/request";
import { store } from "@/lib/store";
import {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
} from "@/lib/store/session-slice";
import { ApiError } from "@/types/api";
import type {
  AdminProfile,
  SystemUserProfile,
} from "@/types/auth";

/**
 * Rehydrate the session on app boot or after a hard refresh.
 *
 * Auth tokens live in httpOnly cookies set by the backend, so the frontend
 * has no on-disk hint about who (if anyone) is logged in. We discover this
 * by calling the profile endpoints — the cookie travels automatically via
 * `withCredentials`, and on a 401 the axios interceptor will refresh once
 * before giving up.
 *
 * Strategy:
 *   1. Try `/system-users/me` first (the common case)
 *   2. On 4xx, fall back to `/admins/profile`
 *   3. If both fail, treat the user as logged out
 *
 * Returns `true` if a session was hydrated into Redux, `false` otherwise.
 */
export async function bootstrapSession(): Promise<boolean> {
  const tenantProfile = await tryFetchSystemUserProfile();
  if (tenantProfile) {
    store.dispatch(
      setSystemUserSession({
        type: "system_user",
        tokens: { accessToken: "", refreshToken: "" },
        profile: tenantProfile,
      })
    );
    return true;
  }

  const adminProfile = await tryFetchAdminProfile();
  if (adminProfile) {
    store.dispatch(
      setAdminSession({
        type: "admin",
        tokens: { accessToken: "", refreshToken: "" },
        profile: adminProfile,
      })
    );
    return true;
  }

  store.dispatch(clearSessionState());
  return false;
}

async function tryFetchSystemUserProfile(): Promise<SystemUserProfile | null> {
  try {
    const data = await apiGet<Record<string, unknown>>("/system-users/me");
    return {
      id: (data.id as string) ?? "",
      fullName: (data.fullName as string) ?? (data.full_name as string) ?? "",
      email: (data.email as string) ?? "",
      role: data.role as SystemUserProfile["role"],
      tenantId:
        (data.tenantId as string) ?? (data.tenant_id as string) ?? "",
      departmentId:
        (data.departmentId as string) ??
        (data.department_id as string) ??
        undefined,
    };
  } catch (err) {
    // 401 means no valid session for this shell; 403 means we have a
    // session but it's the wrong shell (e.g. an admin) — fall through to
    // the admin fetch in either case. Other errors also fall through;
    // a real outage will be surfaced when the user tries to do anything.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    return null;
  }
}

async function tryFetchAdminProfile(): Promise<AdminProfile | null> {
  try {
    const data = await apiGet<Record<string, unknown>>("/admins/profile");
    return {
      id: (data.id as string) ?? "",
      fullName: (data.fullName as string) ?? (data.full_name as string) ?? "",
      email: (data.email as string) ?? "",
    };
  } catch {
    return null;
  }
}
