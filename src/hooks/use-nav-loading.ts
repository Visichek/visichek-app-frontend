"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracks which navigation href is currently loading (pending route transition).
 * Returns the loading href and a click handler to set it.
 * Clears automatically when the pathname changes.
 */
export function useNavLoading() {
  const pathname = usePathname();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);

  // Clear loading state when the route actually changes
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  const handleNavClick = useCallback(
    (href: string) => {
      // Don't show loading if we're already on that page
      if (pathname.startsWith(href)) return;
      setLoadingHref(href);
    },
    [pathname]
  );

  return { loadingHref, handleNavClick };
}
