"use client";

import { usePathname } from "next/navigation";

/**
 * Locked-feature affordances — the padlock overlays, "Locked" badges, and
 * "Pro" tabs we show free-plan tenants — only surface on the dashboard now.
 * Everywhere else they're hidden entirely: per product, we don't advertise
 * locked features or render padlocks outside the dashboard.
 *
 * Returns true when locked UI is allowed to render on the current route.
 * Sidebar / nav locks are NOT governed by this — those are hidden on every
 * route (dropped at the nav-item source in the shells).
 */
export function useLockedUiAllowed(): boolean {
  const pathname = usePathname() ?? "";
  return (
    pathname.startsWith("/app/dashboard") ||
    pathname.startsWith("/admin/dashboard")
  );
}
