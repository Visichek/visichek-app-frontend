"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

export const NAVIGATION_COMMIT_EVENT = "visichek:navigation-commit";

let historyEventsInstalled = false;

export function ensureNavigationCommitEvents(): void {
  if (typeof window === "undefined" || historyEventsInstalled) return;
  historyEventsInstalled = true;

  const notify = () => {
    window.dispatchEvent(new Event(NAVIGATION_COMMIT_EVENT));
  };
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    notify();
    return result;
  };
  window.history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    notify();
    return result;
  };

  window.addEventListener("popstate", notify);
}

export interface NavigationLoadingContextValue {
  /** True while a route transition is in flight. */
  isNavigating: boolean;
  /** The href currently being navigated to, or null. */
  loadingHref: string | null;
  /** Push to a route and mark that target as loading. */
  navigate: (href: string) => void;
  /** Replace the current route and mark that target as loading. */
  replace: (href: string) => void;
  /** Mark an href as loading for <Link> elements that perform their own push. */
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

function isCurrentLocation(pathname: string, href: string): boolean {
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

  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  useEffect(() => {
    ensureNavigationCommitEvents();
    const clearLoading = () => setLoadingHref(null);
    window.addEventListener(NAVIGATION_COMMIT_EVENT, clearLoading);
    return () => {
      window.removeEventListener(NAVIGATION_COMMIT_EVENT, clearLoading);
    };
  }, []);

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
      if (typeof window === "undefined") return;
      if (isCurrentLocation(pathname, href)) return;

      setLoadingHref(href);
      router.push(href);
    },
    [pathname, router],
  );

  const replace = useCallback(
    (href: string) => {
      if (typeof window === "undefined") return;
      if (isCurrentLocation(pathname, href)) return;

      setLoadingHref(href);
      router.replace(href);
    },
    [pathname, router],
  );

  return (
    <NavigationLoadingContext.Provider
      value={{
        isNavigating: loadingHref !== null,
        loadingHref,
        navigate,
        replace,
        handleNavClick,
      }}
    >
      {children}
    </NavigationLoadingContext.Provider>
  );
}

export { useNavLoading, useNavigationLoading } from "@/hooks/use-nav-loading";
