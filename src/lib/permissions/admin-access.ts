/**
 * Platform-admin access scope (Issue 10).
 *
 * Maps an `AdminAccessPreset` to the set of top-level navigation
 * section labels it can see. Used by `admin-shell.tsx` to filter
 * `ADMIN_NAV_ITEMS` before they reach `AppSidebar` and
 * `MobileNavSheet`.
 *
 * Sections (matched by the section's `label` field):
 *   - Dashboard   — always visible
 *   - Customers   — Tenants, Onboarding queue, Marketing opt-ins
 *   - Billing     — Plans, Subscriptions, Discounts
 *   - Content     — Blog, Media, Pricing (new from Issue 10)
 *   - Support     — Support Cases, SLA Watch, Recent Activity
 *   - Settings    — always visible
 *
 * The backend permission dependency is the source of truth for
 * write authorization — this file just hides UI a preset's admin
 * can't usefully touch. Direct-URL access to a hidden section will
 * still hit the page; the page-level guards (and the backend 403)
 * are responsible for refusing.
 */

import type { AdminAccessPreset } from "@/types/auth";

/**
 * Section labels matched against `NavItem.label` in `ADMIN_NAV_ITEMS`.
 * Lower-cased before comparison so a typo in the shell array doesn't
 * silently hide an entire section.
 */
export type AdminSectionKey =
  | "dashboard"
  | "customers"
  | "billing"
  | "content"
  | "support"
  | "admins"
  | "settings";

const PRESET_SECTIONS: Record<AdminAccessPreset, Set<AdminSectionKey>> = {
  all_controls: new Set<AdminSectionKey>([
    "dashboard",
    "customers",
    "billing",
    "content",
    "support",
    "admins",
    "settings",
  ]),
  content_only: new Set<AdminSectionKey>(["dashboard", "content", "settings"]),
  support_only: new Set<AdminSectionKey>(["dashboard", "support", "settings"]),
  content_support: new Set<AdminSectionKey>([
    "dashboard",
    "content",
    "support",
    "settings",
  ]),
  billing_only: new Set<AdminSectionKey>([
    "dashboard",
    "billing",
    "settings",
  ]),
};

function sectionKeyForLabel(label: string): AdminSectionKey | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "dashboard") return "dashboard";
  if (normalized === "customers") return "customers";
  if (normalized === "billing") return "billing";
  if (normalized === "content") return "content";
  if (normalized === "support") return "support";
  if (normalized === "admins") return "admins";
  if (normalized === "settings") return "settings";
  return null;
}

/**
 * Filter the admin navigation array by the current preset. Pass
 * `undefined` to render every section (backwards-compat path for
 * admins provisioned before presets shipped).
 */
export function filterAdminNavByPreset<T extends { label: string }>(
  items: T[],
  preset: AdminAccessPreset | undefined,
): T[] {
  const allowed = PRESET_SECTIONS[preset ?? "all_controls"];
  return items.filter((item) => {
    const key = sectionKeyForLabel(item.label);
    // Unrecognized sections fall through (don't accidentally hide a
    // future top-level nav row just because this file is stale).
    if (!key) return true;
    return allowed.has(key);
  });
}

/** Helper for route guards. */
export function presetCanAccessSection(
  preset: AdminAccessPreset | undefined,
  section: AdminSectionKey,
): boolean {
  return PRESET_SECTIONS[preset ?? "all_controls"].has(section);
}

export const ADMIN_ACCESS_PRESETS: AdminAccessPreset[] = [
  "all_controls",
  "content_only",
  "support_only",
  "content_support",
  "billing_only",
];

export const ADMIN_PRESET_LABEL: Record<AdminAccessPreset, string> = {
  all_controls: "All controls",
  content_only: "Content only",
  support_only: "Support only",
  content_support: "Content + Support",
  billing_only: "Billing only",
};

export const ADMIN_PRESET_DESCRIPTION: Record<AdminAccessPreset, string> = {
  all_controls:
    "Full platform access — manage organizations, billing, content, and support.",
  content_only:
    "Manage marketing content only: blog, media, and pricing display. No access to organizations, billing, or support.",
  support_only:
    "Triage organization support cases and review the activity feed. No access to content, billing, or organization management.",
  content_support:
    "Manage marketing content and respond to organization support cases. No access to billing or organization management.",
  billing_only:
    "Manage plans, subscriptions, and discounts. No access to organizations, content, or support.",
};
