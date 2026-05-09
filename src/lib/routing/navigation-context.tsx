"use client";

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTenantSpaNavEnabled } from "@/lib/routing/spa-nav-flag";

export interface NavigationLoadingContextValue {
  /** True while a route transition is in flight */
  isNavigating: boolean;
  /** The href currently being navigated to, or null */
  loadingHref: string | null;
  /**
   * Push to a new route and mark it as loading.
   * Use this in place of `router.push` for any page-changing action.
   */
  navigate: (href: string) => void;
  /**
   * Mark an href as loading without pushing (for <Link> components that
   * handle the push themselves).
   */
  handleNavClick: (href: string) => void;
}

export const NavigationLoadingContext =
  createContext<NavigationLoadingContextValue | null>(null);

function getLocalHrefUrl(href: string): URL | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string): string {
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
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

/**
 * Hard cap on how long a router.push commit may take before we fall back
 * to a full-page reload. Picked generously: the documented Tooltip-portal
 * stuck-transition crash leaves the URL updated but the tree un-committed
 * indefinitely, so any reasonable budget catches it. A real slow page
 * usually streams its first paint well under this window.
 */
const SPA_COMMIT_FALLBACK_MS = 4000;

export function NavigationLoadingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  function clearFallbackTimer() {
    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }

  // Clear the per-item spinner when the route commits, and cancel any
  // pending SPA-fallback timer so a successful client transition can't
  // trigger a redundant hard reload after the fact.
  useEffect(() => {
    setLoadingHref(null);
    clearFallbackTimer();
  }, [pathname]);

  // Cancel any in-flight fallback timer if the provider unmounts.
  useEffect(() => clearFallbackTimer, []);

  const handleNavClick = useCallback(
    (href: string) => {
      if (!isCurrentLocation(pathname, href)) {
        setLoadingHref(href);
      }
    },
    [pathname],
  );

  /**
   * Programmatic navigation. Two modes, controlled by the
   * `isTenantSpaNavEnabled()` flag:
   *
   *  - MPA (default): `window.location.assign(href)` — bulletproof,
   *    sidesteps the React 19 + Radix Tooltip portal cleanup race that
   *    leaves App Router transitions hung.
   *
   *  - SPA (opt-in): `router.push(href)` with a bounded fallback timer
   *    that hard-reloads to the target if the route never commits within
   *    `SPA_COMMIT_FALLBACK_MS`. Used to verify the underlying race is
   *    fixed in a real browser before flipping the default.
   */
  const navigate = useCallback(
    (href: string) => {
      if (typeof window === "undefined") return;
      if (isCurrentLocation(pathname, href)) return;

      setLoadingHref(href);
      clearFallbackTimer();

      if (isTenantSpaNavEnabled()) {
        router.push(href);
        fallbackTimerRef.current = window.setTimeout(() => {
          // Only fall back if we're still on the original route. The
          // pathname-change effect clears the timer otherwise.
          fallbackTimerRef.current = null;
          window.location.assign(href);
        }, SPA_COMMIT_FALLBACK_MS);
        return;
      }

      window.location.assign(href);
    },
    [pathname, router],
  );

  return (
    <NavigationLoadingContext.Provider
      value={{
        isNavigating: loadingHref !== null,
        loadingHref,
        navigate,
        handleNavClick,
      }}
    >
      {children}
    </NavigationLoadingContext.Provider>
  );
}

// `useNavLoading` is the canonical hook. `useNavigationLoading` is kept as
// a deprecated alias so legacy import paths continue to work — both call
// the same implementation. Re-exported here so callers don't need to
// rewrite their imports.
export { useNavLoading, useNavigationLoading } from "@/hooks/use-nav-loading";
