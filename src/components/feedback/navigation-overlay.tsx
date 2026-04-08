"use client";

import { Loader2 } from "lucide-react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";

/**
 * Full-screen loading overlay shown during page transitions.
 * Mount this inside NavigationLoadingProvider in both shell layouts.
 */
export function NavigationOverlay() {
  const { isNavigating } = useNavigationLoading();

  if (!isNavigating) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Navigating, please wait"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
