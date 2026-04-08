"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useUserSettings } from "@/features/settings/hooks";

/**
 * Syncs the user's API-persisted theme preference into next-themes.
 *
 * On a fresh device, next-themes defaults to "light" (or whatever
 * `defaultTheme` is set to) because localStorage is empty. This hook
 * waits for the user settings query to resolve, then applies the
 * server-side theme preference once — bridging the gap between the
 * API source of truth and the client-side theme provider.
 *
 * It only writes to next-themes once per session (on initial load)
 * to avoid fighting with manual theme changes the user makes on the
 * settings page during the same session.
 */
export function useThemeSync() {
  const { setTheme, theme } = useTheme();
  const { data: userSettings } = useUserSettings();
  const hasSynced = useRef(false);

  useEffect(() => {
    // Only sync once per session, and only when settings have loaded
    if (hasSynced.current || !userSettings?.theme) return;

    const apiTheme = userSettings.theme; // "light" | "dark" | "system"

    // Only update if the API theme differs from the current local theme
    if (apiTheme !== theme) {
      setTheme(apiTheme);
    }

    hasSynced.current = true;
  }, [userSettings, setTheme, theme]);
}
