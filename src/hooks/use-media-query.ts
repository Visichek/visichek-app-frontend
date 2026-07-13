"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Hook to check if a CSS media query matches.
 * Used for responsive patterns like Dialog vs Sheet swap.
 *
 * Reads the match synchronously on the first client render.
 *
 * The previous implementation seeded state to `false` and only corrected it in
 * a `useEffect`, so on a desktop browser the first commit always claimed
 * "mobile". Anything that swaps layout on the result — `ResponsiveModal`
 * (Sheet vs Dialog), `DataTable` (cards vs table) — mounted the wrong branch,
 * then unmounted it and mounted the other one on the next commit. For an open
 * modal that means the open animation runs twice, which reads as the dialog
 * flickering open and shut.
 *
 * `useSyncExternalStore` subscribes to the MediaQueryList and takes the value
 * straight from `matches`, with a separate server snapshot so SSR still
 * renders deterministically.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onStoreChange);
      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  // No viewport on the server. Report `false` (the mobile-first branch) so the
  // markup is deterministic; the client's real value is applied at hydration.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
