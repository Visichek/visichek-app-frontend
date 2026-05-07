"use client";

import {
  createContext,
  useState,
  useEffect,
  useCallback,
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

const NAVIGATION_RECOVERY_DELAY_MS = 2_000;

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

  // Auto-clear when the route actually changes.
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  // If the client transition updates the URL but never commits the new page,
  // recover with the same document navigation users were doing manually.
  useEffect(() => {
    if (!loadingHref) return;

    const timer = window.setTimeout(() => {
      const target = getLocalHrefUrl(loadingHref);
      if (!target) {
        setLoadingHref(null);
        return;
      }

      const currentPath = `${window.location.pathname}${window.location.search}`;
      const targetPath = `${target.pathname}${target.search}`;

      if (currentPath === targetPath) {
        window.location.reload();
        return;
      }

      window.location.assign(target.href);
    }, NAVIGATION_RECOVERY_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loadingHref]);

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
