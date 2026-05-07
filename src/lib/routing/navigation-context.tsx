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

export function NavigationLoadingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);

  // Auto-clear when the route actually changes
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  const handleNavClick = useCallback(
    (href: string) => {
      if (!pathname.startsWith(href)) {
        setLoadingHref(href);
      }
    },
    [pathname],
  );

  const navigate = useCallback(
    (href: string) => {
      if (!pathname.startsWith(href)) {
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
