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
  /**
   * Overlay-safe navigation. Marks `href` as loading immediately, then
   * defers `router.push` until the next two animation frames so any open
   * Radix portal (DropdownMenu, Dialog, Sheet, Popover, ContextMenu,
   * CommandDialog) has finished its close + unmount commit before the
   * App Router swaps the page tree.
   *
   * Use this for navigation triggered from inside floating UI. Routing
   * during the same commit as a portal teardown can crash React with
   * "Cannot read properties of null (reading 'removeChild')" and freeze
   * the page until refresh — see the root layout DOM_RECONCILER_GUARD.
   */
  navigateFromOverlay: (href: string) => void;
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    // The commit event can fire synchronously from inside Next.js's router
    // effects (which call history.replaceState during useInsertionEffect /
    // commit). Calling setState in that phase trips React 19's
    // "useInsertionEffect must not schedule updates" guard, so defer the
    // update to a fresh macrotask so it lands after React's commit fully
    // exits. Microtasks aren't enough — they can flush inside React's same
    // work loop.
    const clearLoading = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        setLoadingHref(null);
      }, 0);
    };
    window.addEventListener(NAVIGATION_COMMIT_EVENT, clearLoading);
    return () => {
      if (timer !== null) clearTimeout(timer);
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

  const navigateFromOverlay = useCallback(
    (href: string) => {
      // Logs are filterable in DevTools (Verbose level shows them, Default
      // hides them). Tagged so a future repro can be reconstructed from the
      // console: who asked, from where, and exactly when each phase fired.
      console.debug("[overlay-nav] requested", { href, from: pathname });

      if (typeof window === "undefined") {
        router.push(href);
        return;
      }
      if (isCurrentLocation(pathname, href)) {
        console.debug("[overlay-nav] skipped (already at target)", { href });
        return;
      }

      setLoadingHref(href);
      // Two rAFs: the first lets the overlay's close handler run and React
      // flush the unmount; the second guarantees the browser has painted
      // that commit before we trigger the page-tree swap.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          console.debug("[overlay-nav] firing router.push", { href });
          router.push(href);
        });
      });
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
        navigateFromOverlay,
      }}
    >
      {children}
    </NavigationLoadingContext.Provider>
  );
}

export { useNavLoading, useNavigationLoading } from "@/hooks/use-nav-loading";
