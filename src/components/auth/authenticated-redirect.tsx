"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/**
 * Client guard for public landing surfaces (like `/`) that should NOT be shown
 * to an already-authenticated user. Sends them straight to their dashboard
 * instead of the login chooser.
 *
 * Renders nothing — drop this at the top of a public page and it'll take over
 * only when there's a live session.
 */
export function AuthenticatedRedirect() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isSystemUser } = useSession();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isAdmin) {
      router.replace("/admin/dashboard");
    } else if (isSystemUser) {
      router.replace("/app/dashboard");
    }
  }, [isAuthenticated, isAdmin, isSystemUser, router]);

  return null;
}
