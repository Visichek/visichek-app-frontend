"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  NAVIGATION_COMMIT_EVENT,
  NavigationLoadingContext,
  ensureNavigationCommitEvents,
  type NavigationLoadingContextValue,
} from "@/lib/routing/navigation-context";

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

  useEffect(() => {
    setLocalLoadingHref(null);
  }, [pathname]);

  useEffect(() => {
    ensureNavigationCommitEvents();
    let timer: ReturnType<typeof setTimeout> | null = null;
    // The commit event can fire synchronously from inside Next.js's router
    // effects (which call history.replaceState during useInsertionEffect /
    // commit). setState in that phase trips React 19's
    // "useInsertionEffect must not schedule updates" guard, so defer to a
    // fresh macrotask. See NavigationLoadingProvider for the same pattern.
    const clearLoading = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        setLocalLoadingHref(null);
      }, 0);
    };
    window.addEventListener(NAVIGATION_COMMIT_EVENT, clearLoading);
    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener(NAVIGATION_COMMIT_EVENT, clearLoading);
    };
  }, []);

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
      router.push(href);
    },
    [pathname, router],
  );

  const localReplace = useCallback(
    (href: string) => {
      if (typeof window === "undefined") return;
      if (isCurrentLocation(pathname, href)) return;

      setLocalLoadingHref(href);
      router.replace(href);
    },
    [pathname, router],
  );

  // Mirrors NavigationLoadingProvider.navigateFromOverlay for local scope.
  // See that function for why the double rAF is required.
  const localNavigateFromOverlay = useCallback(
    (href: string) => {
      console.debug("[overlay-nav] requested (local)", { href, from: pathname });

      if (typeof window === "undefined") {
        router.push(href);
        return;
      }
      if (isCurrentLocation(pathname, href)) {
        console.debug("[overlay-nav] skipped (already at target)", { href });
        return;
      }

      setLocalLoadingHref(href);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          console.debug("[overlay-nav] firing router.push (local)", { href });
          router.push(href);
        });
      });
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
    replace: localReplace,
    handleNavClick: localHandleNavClick,
    navigateFromOverlay: localNavigateFromOverlay,
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
