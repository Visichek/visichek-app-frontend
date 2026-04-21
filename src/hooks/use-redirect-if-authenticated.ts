"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./use-session";
import { getPostLoginPath } from "@/lib/routing/redirects";

/**
 * Guard for public login pages.
 *
 * If the user already has a live session (rehydrated by `bootstrapSession`
 * in providers.tsx), redirect them to their role's default route instead
 * of showing the login form. While the redirect is in flight, `isChecking`
 * stays true so the caller can render a spinner rather than flashing the
 * form.
 *
 * Bootstrap is already awaited in providers.tsx before children mount, so
 * by the time this hook runs the session state is final — no extra refresh
 * or timing dance needed here.
 */
export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const { isAuthenticated, sessionType, systemUserProfile } = useSession();
  const [isChecking, setIsChecking] = useState(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !sessionType) {
      setIsChecking(false);
      return;
    }
    const target = getPostLoginPath(sessionType, systemUserProfile?.role);
    router.replace(target);
  }, [isAuthenticated, sessionType, systemUserProfile?.role, router]);

  return { isChecking };
}
