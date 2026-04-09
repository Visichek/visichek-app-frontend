"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Theme toggle with a circular clip-path reveal using the View Transitions API.
 *
 * The new theme is revealed through an expanding circle originating from the
 * button — the old page remains fully visible as a frozen layer behind it, so
 * content is never hidden during the transition.
 *
 * Falls back to an instant swap when:
 *   - the browser doesn't support View Transitions
 *   - `prefers-reduced-motion: reduce` is active
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const handleToggle = useCallback(() => {
    const isDark = resolvedTheme === "dark";
    const nextTheme = isDark ? "light" : "dark";

    // Reduced-motion or no button ref: instant swap, no animation
    if (reducedMotion || !buttonRef.current) {
      setTheme(nextTheme);
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    // Pass origin to CSS via custom properties on <html>
    document.documentElement.style.setProperty("--reveal-x", `${x}px`);
    document.documentElement.style.setProperty("--reveal-y", `${y}px`);

    // View Transitions API: browser freezes current state, we apply the new
    // theme inside the callback, then CSS animates the reveal.
    if (!("startViewTransition" in document)) {
      setTheme(nextTheme);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).startViewTransition(() => {
      setTheme(nextTheme);
    });
  }, [resolvedTheme, setTheme, reducedMotion]);

  if (!mounted) {
    return <div className="min-h-[44px] min-w-[44px]" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          className={cn("min-h-[44px] min-w-[44px] relative overflow-hidden")}
          onClick={handleToggle}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span
            key={isDark ? "sun" : "moon"}
            className="flex items-center justify-center animate-icon-swap-in"
          >
            {isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark
          ? "Switch to light mode for a brighter appearance"
          : "Switch to dark mode for a dimmer appearance"}
      </TooltipContent>
    </Tooltip>
  );
}
