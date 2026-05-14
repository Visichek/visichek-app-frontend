"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsBootstrapping } from "@/lib/store/session-slice";
import { isLogoutTransitionActive } from "@/lib/auth/auth-transition";
import type { SessionType } from "@/types/auth";

interface AuthGuardProps {
  shell: SessionType;
  children: React.ReactNode;
}

/**
 * Client guard for authenticated shells.
 *
 * Providers already blocks render until `bootstrapSession()` finishes, so by
 * the time this mounts, `isAuthenticated` and `sessionType` are authoritative.
 *
 * Rules:
 * - not authenticated → replace with this shell's login page
 * - authenticated on the wrong shell → replace with the correct dashboard
 *   (admin user on /app/* → /admin/dashboard; tenant user on /admin/* →
 *   /app/dashboard)
 *
 * Render nothing while redirecting to avoid flashing protected UI.
 */
export function AuthGuard({ shell, children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, sessionType } = useSession();
  const isBootstrapping = useAppSelector(selectIsBootstrapping);
  const isLoggingOut = isLogoutTransitionActive();

  // While bootstrap is unresolved, session state is unknown. Render nothing
  // (BootstrapGate is already showing a spinner) so we never flash protected
  // shell UI for the wrong identity in the window before bootstrap settles.
  const redirectPath = isBootstrapping
    ? null
    : resolveRedirect(shell, isAuthenticated, sessionType);

  useEffect(() => {
    if (!isLoggingOut && redirectPath) {
      router.replace(redirectPath);
    }
  }, [isLoggingOut, redirectPath, router]);

  if (isBootstrapping || isLoggingOut || redirectPath) return null;

  return <>{children}</>;
}

function resolveRedirect(
  shell: SessionType,
  isAuthenticated: boolean,
  sessionType: SessionType | null,
): string | null {
  if (!isAuthenticated) {
    return shell === "admin" ? "/admin/login" : "/app/login";
  }
  if (sessionType !== shell) {
    return sessionType === "admin" ? "/admin/dashboard" : "/app/dashboard";
  }
  return null;
}
