"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/features/settings/hooks";

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
 *
 * Persistence (Issue 4):
 *   When the user is authenticated, the chosen theme is persisted through
 *   the user-settings endpoint (PATCH /admins/settings or /system-users/settings,
 *   depending on session type). The local next-themes value is updated
 *   optimistically; if the server call fails we toast the error and roll back
 *   so the icon never lies about persisted state.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const updateSettings = useUpdateUserSettings();
  const { data: userSettings } = useUserSettings();
  // Last theme the server confirmed it accepted. Used as the rollback target
  // when the persist call fails — initialized from the resolved theme so a
  // first-time toggle has something sensible to roll back to.
  const lastConfirmedTheme = useRef<"light" | "dark" | null>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    // Keep the rollback target in sync with whatever the server most
    // recently said the user's theme is. The server sends "system" too —
    // treat that as "no saved binary preference" by leaving the ref alone.
    const t = userSettings?.theme;
    if (t === "light" || t === "dark") {
      lastConfirmedTheme.current = t;
    }
  }, [userSettings?.theme]);

  const applyTheme = useCallback(
    (next: "light" | "dark") => {
      if (reducedMotion || !buttonRef.current) {
        setTheme(next);
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const x = Math.round(rect.left + rect.width / 2);
      const y = Math.round(rect.top + rect.height / 2);

      document.documentElement.style.setProperty("--reveal-x", `${x}px`);
      document.documentElement.style.setProperty("--reveal-y", `${y}px`);

      if (!("startViewTransition" in document)) {
        setTheme(next);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(() => {
        setTheme(next);
      });
    },
    [setTheme, reducedMotion],
  );

  const handleToggle = useCallback(() => {
    if (updateSettings.isPending) return; // Debounce rapid flips during a save.

    const isDark = resolvedTheme === "dark";
    const nextTheme: "light" | "dark" = isDark ? "light" : "dark";
    const previousTheme: "light" | "dark" = isDark ? "dark" : "light";

    // Optimistic UI: flip the icon immediately.
    applyTheme(nextTheme);

    // If the user isn't authenticated yet (e.g., on the public login page
    // before /me has hydrated), don't try to persist — next-themes will
    // still keep the local preference and useThemeSync will reconcile
    // after login.
    if (!isAuthenticated) return;

    updateSettings.mutate(
      { theme: nextTheme },
      {
        onSuccess: () => {
          lastConfirmedTheme.current = nextTheme;
        },
        onError: (err) => {
          // Roll back the icon so it stops claiming the new theme is saved.
          applyTheme(previousTheme);
          const message =
            err instanceof Error
              ? err.message
              : "Couldn't save your theme preference.";
          toast.error(message);
        },
      },
    );
  }, [
    applyTheme,
    isAuthenticated,
    resolvedTheme,
    updateSettings,
  ]);

  if (!mounted) {
    return <div className="min-h-[44px] min-w-[44px]" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";
  const saving = updateSettings.isPending;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          className={cn("min-h-[44px] min-w-[44px] relative overflow-hidden")}
          onClick={handleToggle}
          disabled={saving}
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
        {saving
          ? "Saving your theme preference…"
          : isDark
            ? "Switch to light mode for a brighter appearance"
            : "Switch to dark mode for a dimmer appearance"}
      </TooltipContent>
    </Tooltip>
  );
}
