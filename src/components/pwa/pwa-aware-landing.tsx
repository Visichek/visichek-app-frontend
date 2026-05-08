"use client";

import { useState, type ReactNode } from "react";
import { PwaSplash } from "./pwa-splash";

/**
 * Renders the public landing only when we're NOT in PWA standalone mode.
 * In standalone mode (the user opened the installed app and somehow ended
 * up at `/` — typically by hitting "home" inside the PWA), we hand off to
 * <PwaSplash> which redirects them to dashboard or login instead of
 * showing the dual-portal chooser.
 *
 * The matchMedia check is read synchronously in the lazy useState
 * initializer so the very first client commit picks the right branch.
 * SSR has no `window`, so the server still renders `children` — there's
 * a brief flash for users who navigate to `/` from inside the PWA before
 * JS executes. The primary case (clicking the PWA icon) goes through
 * `/?launch=pwa` which is handled SSR-side in page.tsx, so no flash.
 *
 * The body has `suppressHydrationWarning` (see app/layout.tsx) which
 * silences the SSR/CSR mismatch warning for this intentional swap.
 */
export function PwaAwareLanding({ children }: { children: ReactNode }) {
  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(display-mode: standalone)").matches;
  });

  if (isStandalone) return <PwaSplash />;
  return <>{children}</>;
}
