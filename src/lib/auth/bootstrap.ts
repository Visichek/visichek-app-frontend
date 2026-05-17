import { apiGet } from "@/lib/api/request";
import { store } from "@/lib/store";
import {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
  markBootstrapDone,
} from "@/lib/store/session-slice";
import { readAuthHint } from "@/lib/auth/auth-hint";
import { shouldSuppressAuthRehydrate } from "@/lib/auth/auth-transition";
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
 * Strategy: pick the probe order based on the last-known session type
 * (auth hint) or the current URL shell, then try the other endpoint as
 * fallback. This avoids burning a guaranteed 403 on `/system-users/me`
 * for platform admins (and a 403 on `/admins/profile` for tenant users)
 * on every cold load.
 *
 * Returns `true` if a session was hydrated into Redux, `false` otherwise.
 */
// Hard ceiling on the boot probe. The chained calls (`/system-users/me` →
// 401 → `/auth/refresh` → `/admins/profile`) can otherwise compound to ~70s
// of spinner if the API stalls on any leg. After this elapses we resolve
// the boot promise so the app can render — but we leave session state
// alone, because runBootstrap may complete later and dispatch a real
// session. (Wiping state in the timer would also wipe a session that
// runBootstrap had already set seconds earlier, which silently logs the
// user out partway through their session.)
const BOOTSTRAP_HARD_TIMEOUT_MS = 8_000;

type ProbeOrder = "system_user_first" | "admin_first";

// Decide which profile endpoint to probe first. The auth hint (last-known
// session type, written to localStorage on login) is the strongest signal.
// If it's missing we fall back to the URL shell — `/admin/*` is the
// platform-admin shell, `/app/*` is the tenant shell. Anything else
// defaults to system_user first since that's the broader user base.
function pickProbeOrder(): ProbeOrder {
  const hint = readAuthHint();
  if (hint?.sessionType === "admin") return "admin_first";
  if (hint?.sessionType === "system_user") return "system_user_first";

  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/admin")) return "admin_first";
    if (path.startsWith("/app")) return "system_user_first";
  }

  return "system_user_first";
}

export async function bootstrapSession(): Promise<boolean> {
  if (shouldSuppressAuthRehydrate()) {
    store.dispatch(clearSessionState());
    store.dispatch(markBootstrapDone());
    return false;
  }

  // No auth hint = no session expected. The hint is written on every
  // successful login and cleared on every logout via the Redux subscription
  // in `lib/store/index.ts`, so its absence is a reliable client-side
  // signal that we are logged out. Skipping the /me probe here avoids
  // firing a guaranteed-to-fail /auth/refresh (3 attempts × 5s timeout =
  // up to 15s of needless network) for users who simply don't have cookies
  // — that was the source of the "app tries to refresh even without
  // cookies" loop on protected routes.
  if (!readAuthHint()) {
    store.dispatch(clearSessionState());
    store.dispatch(markBootstrapDone());
    return false;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), BOOTSTRAP_HARD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([runBootstrap(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    // Safety net: if the timeout race resolved before runBootstrap finished,
    // release the gate so UI surfaces (PwaSplash, AuthGuards) can stop
    // waiting. runBootstrap also dispatches this in its own finally; the
    // reducer is idempotent so the duplicate is harmless.
    if (store.getState().session.isBootstrapping) {
      store.dispatch(markBootstrapDone());
    }
  }
}

async function runBootstrap(): Promise<boolean> {
  try {
    const order = pickProbeOrder();

    if (order === "admin_first") {
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
    } else {
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
    }

    store.dispatch(clearSessionState());
    return false;
  } finally {
    // Always mark done, even if the network probes throw unexpectedly.
    // PwaSplash and similar consumers depend on this transition to know
    // they should stop showing the splash and redirect.
    store.dispatch(markBootstrapDone());
  }
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
    const accessPresetRaw =
      (data.accessPreset as string | undefined) ??
      (data.access_preset as string | undefined);
    return {
      id: (data.id as string) ?? "",
      fullName: (data.fullName as string) ?? (data.full_name as string) ?? "",
      email: (data.email as string) ?? "",
      accessPreset: accessPresetRaw as AdminProfile["accessPreset"],
      mfaEnabled:
        (data.mfaEnabled as boolean | undefined) ??
        (data.mfa_enabled as boolean | undefined),
    };
  } catch {
    return null;
  }
}
