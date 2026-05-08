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
// nudge the router. Slow networks and chunk downloads can legitimately take a
// few seconds, so keep this generous and never hard-reload from here.
const STUCK_NAV_THRESHOLD_MS = 8000;
const STUCK_NAV_POLL_MS = 250;
const NAV_LOADING_TIMEOUT_MS = 12_000;

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

  // The clicked item should give immediate feedback, but a router transition
  // must never block the whole shell forever. If the destination does not
  // commit within the timeout, release the overlay. Query-only navigations
  // keep the same pathname, so we also clear as soon as the browser URL has
  // the requested search string.
  useEffect(() => {
    if (!loadingHref) return;

    const timeoutId = window.setTimeout(() => {
      setLoadingHref(null);
    }, NAV_LOADING_TIMEOUT_MS);

    const intervalId = window.setInterval(() => {
      if (isCurrentLocation(pathname, loadingHref)) {
        setLoadingHref(null);
      }
    }, STUCK_NAV_POLL_MS);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadingHref, pathname]);

  // Recover from stuck App Router transitions. Symptom: URL bar updates but
  // the page tree has not committed yet. We watch for
  // `window.location.pathname` diverging from the committed React `pathname`
  // for longer than the threshold; once confirmed stuck, we ask the router to
  // refetch the current segment. Avoid hard reloads here: doing that from a
  // polling effect can turn one slow transition into a reload loop.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let stuckSince: number | null = null;
    let refreshed = false;

    const intervalId = window.setInterval(() => {
      const urlPath = window.location.pathname;
      const renderedPath = pathnameRef.current ?? "";

      if (urlPath === renderedPath) {
        stuckSince = null;
        refreshed = false;
        return;
      }

      const now = Date.now();
      if (stuckSince === null) {
        stuckSince = now;
        return;
      }

      if (!refreshed && now - stuckSince >= STUCK_NAV_THRESHOLD_MS) {
        refreshed = true;
        router.refresh();
        return;
      }

    }, STUCK_NAV_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [router]);

  const handleNavClick = useCallback(
    (href: string) => {
      if (!isCurrentLocation(pathname, href)) {
        setLoadingHref(href);
      }
    },
    [pathname],
  );

  const navigate = useCallback(
    (href: string) => {
      if (!isCurrentLocation(pathname, href)) {
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
