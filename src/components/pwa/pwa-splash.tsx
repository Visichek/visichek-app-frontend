"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { readAuthHint, type AuthHint } from "@/lib/auth/auth-hint";

/**
 * Full-screen splash shown to PWA users in place of the dual-portal
 * landing page. The PWA starts at `/?launch=pwa` (set in manifest), so
 * SSR knows to render this directly — no flash of the login chooser.
 *
 * Behavior:
 *   - While bootstrap is pending → splash (logo + subtle spinner)
 *   - Bootstrap completes with a session → redirect to that role's dashboard
 *   - Bootstrap completes without a session → redirect to the right login
 *     (admin if the last-known hint was admin, else tenant)
 *   - Bootstrap stalls past SAFETY_TIMEOUT_MS → fall through to login
 *     using the same hint logic, so we never strand the user on the splash
 *
 * `hasRedirectedRef` makes the success path and the safety net mutually
 * exclusive — whichever fires first wins and the other becomes a no-op.
 */

const SAFETY_TIMEOUT_MS = 10_000;

function pickLoginPathForHint(hint: AuthHint | null): string {
  return hint?.sessionType === "admin" ? "/admin/login" : "/app/login";
}

function pickDashboardPath(isAdmin: boolean): string {
  return isAdmin ? "/admin/dashboard" : "/app/dashboard";
}

export function PwaSplash() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isBootstrapping } = useSession();
  const hasRedirectedRef = useRef(false);

  // Capture the auth hint snapshot at mount. If bootstrap fails it'll
  // clear the live hint via the store subscription, so reading it later
  // would give us the wrong (or no) session type. The snapshot lets us
  // route admins back to /admin/login even on a failed bootstrap.
  const [initialHint] = useState<AuthHint | null>(() => readAuthHint());

  // Primary redirect: react to bootstrap completion.
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (isBootstrapping) return;

    hasRedirectedRef.current = true;
    const target = isAuthenticated
      ? pickDashboardPath(isAdmin)
      : pickLoginPathForHint(initialHint);
    router.replace(target);
  }, [isBootstrapping, isAuthenticated, isAdmin, router, initialHint]);

  // Safety net: bootstrap could stall on a hung backend past the 8s hard
  // timeout (the timer in bootstrapSession() races runBootstrap, but
  // markBootstrapDone won't fire until runBootstrap actually settles).
  // After SAFETY_TIMEOUT_MS we give up and send the user to login —
  // they can sign in normally. If bootstrap later succeeds, the login
  // page's own redirect-if-authenticated guard moves them on.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(pickLoginPathForHint(initialHint));
    }, SAFETY_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
    // Run once on mount — the safety deadline is independent of session
    // state changes, and re-arming it on every change would defeat the
    // point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen bg-white text-gray-900 flex items-center justify-center relative overflow-hidden font-sans"
      role="status"
      aria-live="polite"
      aria-label="Loading VisiChek"
    >
      <div className="flex flex-col items-center gap-6 relative z-10 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3A9615]/10 text-[#3A9615]">
          <ShieldCheck size={32} aria-hidden="true" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-display font-bold tracking-tight text-gray-900">
            VisiChek
          </span>
          <span className="text-sm text-gray-500">
            Enterprise Visitor Management
          </span>
        </div>
        <div
          className="mt-2 h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
