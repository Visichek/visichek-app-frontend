"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  NavigationLoadingContext,
  type NavigationLoadingContextValue,
} from "@/lib/routing/navigation-context";
import { isTenantSpaNavEnabled } from "@/lib/routing/spa-nav-flag";

/** Mirror of the global-provider fallback budget; see navigation-context.tsx. */
const SPA_COMMIT_FALLBACK_MS = 4000;

export type NavLoadingScope = "global" | "local";

export interface UseNavLoadingOptions {
  /**
   * Where the loading state lives.
   *
   * - `"global"` (default): reads/writes the shared
   *   `NavigationLoadingProvider` context. Every consumer in the app sees
   *   the same `loadingHref`, which is what the sidebar / topbar rely on.
   *   Requires the provider to be mounted (it already is, in
   *   `app/providers.tsx`).
   * - `"local"`: state lives inside this hook instance only. Use this
   *   when you want a truly isolated indicator that nothing else in the
   *   tree should react to (rare).
   */
  scope?: NavLoadingScope;
}

/**
 * Tracks which navigation href is currently loading and provides handlers
 * to set it. Returns the same shape regardless of `scope` so call sites
 * can switch between modes by changing only the prop.
 *
 * The state clears when `usePathname()` reports a new committed pathname.
 * No timers, no polling, no auto-refresh — Next.js's `loading.tsx`
 * skeletons handle perceived latency, and the clicked item spins for
 * exactly as long as the transition takes.
 */
export function useNavLoading(
  options?: UseNavLoadingOptions,
): NavigationLoadingContextValue {
  const scope: NavLoadingScope = options?.scope ?? "global";

  // Both context and local-state machinery are set up unconditionally so
  // we obey the rules of hooks. Whichever the scope picks is what we
  // expose; the unused side is essentially free.
  const ctx = useContext(NavigationLoadingContext);

  const pathname = usePathname();
  const router = useRouter();
  const [localLoadingHref, setLocalLoadingHref] = useState<string | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  function clearFallbackTimer() {
    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }

  useEffect(() => {
    setLocalLoadingHref(null);
    clearFallbackTimer();
  }, [pathname]);

  // Cancel any in-flight fallback timer if the consumer unmounts.
  useEffect(() => clearFallbackTimer, []);

  const localHandleNavClick = useCallback(
    (href: string) => {
      if (!isCurrentLocation(pathname, href)) {
        setLocalLoadingHref(href);
      }
    },
    [pathname],
  );

  // Mirrors NavigationLoadingProvider.navigate — see that function for
  // the full SPA-vs-MPA decision logic. Local scope keeps its own timer
  // so consumers can opt into the SPA path without depending on the
  // global provider.
  const localNavigate = useCallback(
    (href: string) => {
      if (typeof window === "undefined") return;
      if (isCurrentLocation(pathname, href)) return;

      setLocalLoadingHref(href);
      clearFallbackTimer();

      if (isTenantSpaNavEnabled()) {
        router.push(href);
        fallbackTimerRef.current = window.setTimeout(() => {
          fallbackTimerRef.current = null;
          window.location.assign(href);
        }, SPA_COMMIT_FALLBACK_MS);
        return;
      }

      window.location.assign(href);
    },
    [pathname, router],
  );

  if (scope === "global") {
    if (!ctx) {
      throw new Error(
        "useNavLoading({ scope: 'global' }) requires NavigationLoadingProvider " +
          "to be mounted higher in the tree. Pass { scope: 'local' } if you want " +
          "isolated state instead.",
      );
    }
    return ctx;
  }

  return {
    isNavigating: localLoadingHref !== null,
    loadingHref: localLoadingHref,
    navigate: localNavigate,
    handleNavClick: localHandleNavClick,
  };
}

/**
 * @deprecated Use `useNavLoading()` instead. Kept as a thin alias so the
 * ~50 existing import sites don't need to be touched in one go. New code
 * should import `useNavLoading` from `@/hooks/use-nav-loading`.
 */
export function useNavigationLoading(): NavigationLoadingContextValue {
  return useNavLoading();
}

function normalizePathname(pathname: string): string {
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

function getLocalHrefUrl(href: string): URL | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}

function getCurrentSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search.replace(/^\?/, "");
}

function isCurrentLocation(
  pathname: string,
  href: string,
): boolean {
  const url = getLocalHrefUrl(href);
  const rawPathname = url?.pathname ?? href.split(/[?#]/)[0];
  const targetPathname = normalizePathname(rawPathname);

  if (normalizePathname(pathname) !== targetPathname) return false;

  const hasExplicitSearch = href.includes("?");
  if (!hasExplicitSearch) return true;

  return getCurrentSearch() === (url?.search ?? "").replace(/^\?/, "");
}
