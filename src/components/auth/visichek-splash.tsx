"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { BrandedSplash } from "@/components/auth/branded-splash";

/**
 * Branded loading splash shown at `/`. Plays a short entrance animation
 * (logo + wordmark + animated progress bar) while session bootstrap
 * resolves, then routes the user to where they actually belong:
 *
 *   - authenticated admin → `/admin/dashboard`
 *   - authenticated tenant user → `/app/dashboard`
 *   - unauthenticated → `/login` (dual-portal chooser)
 *
 * A minimum on-screen time keeps the animation from flashing past on
 * fast networks. A safety timer guarantees we never strand the user on
 * the splash if bootstrap stalls on a hung backend.
 */

const MIN_VISIBLE_MS = 1600;
const SAFETY_TIMEOUT_MS = 10_000;

export function VisichekSplash() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isSystemUser, isBootstrapping } = useSession();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (isBootstrapping) return;
    if (!minTimeElapsed) return;

    hasRedirectedRef.current = true;
    if (isAuthenticated && isAdmin) {
      router.replace("/admin/dashboard");
    } else if (isAuthenticated && isSystemUser) {
      router.replace("/app/dashboard");
    } else {
      router.replace("/login");
    }
  }, [
    isAuthenticated,
    isAdmin,
    isSystemUser,
    isBootstrapping,
    minTimeElapsed,
    router,
  ]);

  useEffect(() => {
    const safety = window.setTimeout(() => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace("/login");
    }, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(safety);
  }, [router]);

  return <BrandedSplash />;
}
