"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
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

  const redirectPath = resolveRedirect(shell, isAuthenticated, sessionType);

  useEffect(() => {
    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [redirectPath, router]);

  if (redirectPath) return null;

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
