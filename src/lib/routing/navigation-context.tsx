"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavigationLoadingContextValue {
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

const NavigationLoadingContext =
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

export function useNavigationLoading(): NavigationLoadingContextValue {
  const ctx = useContext(NavigationLoadingContext);
  if (!ctx) {
    throw new Error(
      "useNavigationLoading must be used within NavigationLoadingProvider",
    );
  }
  return ctx;
}
