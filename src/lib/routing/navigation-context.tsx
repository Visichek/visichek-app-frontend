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

/**
 * Shared route-loading state. Consumers should read this via
 * `useNavLoading()` (canonical) — `useNavigationLoading()` is kept as a
 * deprecated alias so legacy imports keep working.
 */
export const NavigationLoadingContext =
  createContext<NavigationLoadingContextValue | null>(null);

// How long the URL bar may diverge from React's committed pathname before we
// treat the navigation as stuck. App Router transitions normally commit in
// well under a second; anything past 1.5s with the URL already updated is a
// stuck transition (stale RSC payload, wedged router cache, etc.).
const STUCK_NAV_THRESHOLD_MS = 1500;
const STUCK_NAV_POLL_MS = 250;

function getLocalHrefUrl(href: string): URL | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}

function isCurrentPath(pathname: string, href: string): boolean {
  const url = getLocalHrefUrl(href);
  const rawPathname = url?.pathname ?? href.split(/[?#]/)[0];
  const targetPathname =
    rawPathname === "/" ? "/" : rawPathname.replace(/\/$/, "");

  return pathname === targetPathname;
}

export function NavigationLoadingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);

  // Latest committed pathname, readable from the polling loop without making
  // it a dep (we don't want to tear down the loop on every route change).
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Auto-clear when the route actually commits.
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  // Recover from stuck App Router transitions. Symptom: URL bar updates but
  // the page tree never commits (the user sees the old page until they
  // manually refresh). Cause is usually a stale RSC payload or a wedged
  // client router cache. We watch for `window.location.pathname` diverging
  // from the committed React `pathname` for longer than the threshold; once
  // confirmed stuck, we ask the router to refetch the current segment with
  // `router.refresh()`. If that still doesn't unstick within another window,
  // we hard-reload as a last resort. This catches both `<Link>` clicks and
  // `router.push` calls — not just navigations that go through `navigate()`
  // / `handleNavClick()`.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let stuckSince: number | null = null;
    let refreshAt: number | null = null;

    const intervalId = window.setInterval(() => {
      const urlPath = window.location.pathname;
      const renderedPath = pathnameRef.current ?? "";

      if (urlPath === renderedPath) {
        stuckSince = null;
        refreshAt = null;
        return;
      }

      const now = Date.now();
      if (stuckSince === null) {
        stuckSince = now;
        return;
      }

      if (refreshAt === null && now - stuckSince >= STUCK_NAV_THRESHOLD_MS) {
        refreshAt = now;
        router.refresh();
        return;
      }

      // Refresh didn't unstick — hard navigate to the URL the user already
      // sees in the address bar. This is intentionally the final fallback;
      // if it ever fires repeatedly there's a deeper bug to chase.
      if (refreshAt !== null && now - refreshAt >= STUCK_NAV_THRESHOLD_MS) {
        window.location.assign(window.location.href);
      }
    }, STUCK_NAV_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [router]);

  const handleNavClick = useCallback(
    (href: string) => {
      if (!isCurrentPath(pathname, href)) {
        setLoadingHref(href);
      }
    },
    [pathname],
  );

  const navigate = useCallback(
    (href: string) => {
      if (!isCurrentPath(pathname, href)) {
        setLoadingHref(href);
      }
      router.push(href);
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
