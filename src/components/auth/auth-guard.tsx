"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useAppSelector } from "@/lib/store/hooks";
import {
  selectAdminProfile,
  selectIsBootstrapping,
  selectSystemUserProfile,
} from "@/lib/store/session-slice";
import { isLogoutTransitionActive } from "@/lib/auth/auth-transition";
import { readAuthHint } from "@/lib/auth/auth-hint";
import type { SessionType } from "@/types/auth";

interface AuthGuardProps {
  shell: SessionType;
  children: React.ReactNode;
}

/**
 * Client guard for authenticated shells.
 *
 * Decision order (designed to render NOTHING — and call NO endpoints —
 * while we're still figuring out whether the user belongs here):
 *
 *  1. Synchronous localStorage check. If there's no auth hint, the user
 *     has not successfully logged in on this browser, so we redirect
 *     immediately to the right login page without waiting on bootstrap
 *     and without firing any API request. This is what eliminates the
 *     "/me → /auth/refresh × 3" cascade you'd otherwise see for
 *     logged-out users opening a protected URL.
 *  2. While bootstrap is still in flight, render null. `BootstrapGate`
 *     is already showing the splash; AuthGuard's children must not mount
 *     yet, or their data hooks will fire before we know who (if anyone)
 *     is logged in.
 *  3. Once bootstrap settles, redirect when authenticated for the wrong
 *     shell, or to login when no session was hydrated.
 *  4. Only when everything matches do we render `children`. Because the
 *     shells now isolate every data-fetching hook inside the inner
 *     component, no protected endpoint is ever called for an unauthed
 *     user.
 */
export function AuthGuard({ shell, children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, sessionType } = useSession();
  const isBootstrapping = useAppSelector(selectIsBootstrapping);
  const adminProfile = useAppSelector(selectAdminProfile);
  const systemUserProfile = useAppSelector(selectSystemUserProfile);
  // A first-login / temp-password user must set a real password before the
  // backend lets them touch any shell endpoint. Route them out to the
  // change-password screen rather than rendering a shell that 403s.
  const mustChangePassword =
    shell === "admin"
      ? Boolean(adminProfile?.mustChangePassword)
      : Boolean(systemUserProfile?.mustChangePassword);
  const isLoggingOut = isLogoutTransitionActive();

  // Read the auth hint ONCE on mount. We use it as a synchronous tripwire
  // for the no-session case. Recomputing on every render isn't worth the
  // cost — the hint is updated by the Redux subscription on login/logout,
  // and the consumer of "no hint → redirect" only cares about the value
  // at mount.
  const [hasHint] = useState<boolean>(() => readAuthHint() !== null);

  const targetShellLogin = shell === "admin" ? "/admin/login" : "/app/login";

  // 1. No hint → not logged in. Redirect immediately, render nothing.
  useEffect(() => {
    if (!hasHint && !isLoggingOut) {
      router.replace(targetShellLogin);
    }
    // The hint is read once; intentionally not in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2/3. Once bootstrap is done, resolve a redirect based on real state.
  const redirectPath =
    !hasHint || isBootstrapping
      ? null
      : resolveRedirect(shell, isAuthenticated, sessionType, mustChangePassword);

  useEffect(() => {
    if (!isLoggingOut && redirectPath) {
      router.replace(redirectPath);
    }
  }, [isLoggingOut, redirectPath, router]);

  if (!hasHint || isBootstrapping || isLoggingOut || redirectPath) {
    return null;
  }

  return <>{children}</>;
}

function resolveRedirect(
  shell: SessionType,
  isAuthenticated: boolean,
  sessionType: SessionType | null,
  mustChangePassword: boolean,
): string | null {
  if (!isAuthenticated) {
    return shell === "admin" ? "/admin/login" : "/app/login";
  }
  if (sessionType !== shell) {
    return sessionType === "admin" ? "/admin/dashboard" : "/app/dashboard";
  }
  // Funnel a temp-password user to the change-password screen (a public page,
  // so this guard won't re-run there) before any shell content mounts.
  if (mustChangePassword) {
    return shell === "admin"
      ? "/admin/change-password"
      : "/app/change-password";
  }
  return null;
}
