/**
 * Frontend route registry (Issue 2 follow-up).
 *
 * Every route that exists in either shell, recorded once so the
 * notification route resolver, dashboard attention items, command
 * launcher, and any future deep-link surface have a single place to
 * check "does this path lead somewhere real?".
 *
 * Prefix matching, not exact: an entry like
 * `/admin/support-cases/` registers the entire detail subtree
 * (`/admin/support-cases/abc123` matches). Use no trailing slash to
 * match a single exact route.
 *
 * When you add a new route to `app/(platform-admin)` or `app/(tenant)`,
 * add the prefix here so the route-resolver smoke test catches
 * notification emitters that point at the old URL.
 */

export interface RouteEntry {
  /** Path prefix that lives under the corresponding shell. */
  prefix: string;
  /**
   * `prefix-match` allows any path that startsWith(prefix); `exact`
   * requires equality (used for index routes like `/admin/dashboard`).
   */
  kind: "prefix-match" | "exact";
}

export const ADMIN_ROUTES: RouteEntry[] = [
  { prefix: "/admin/dashboard", kind: "exact" },
  { prefix: "/admin/tenants", kind: "prefix-match" },
  // The onboarding queue lives under `/admin/tenants/onboarding/...`.
  // We register both because notification emitters may target either
  // — the prefix-match on `/admin/tenants` covers both today, but
  // listing the explicit child here makes the intent grep-friendly.
  { prefix: "/admin/tenants/onboarding", kind: "prefix-match" },
  { prefix: "/admin/marketing", kind: "prefix-match" },
  { prefix: "/admin/plans", kind: "prefix-match" },
  { prefix: "/admin/subscriptions", kind: "prefix-match" },
  { prefix: "/admin/discounts", kind: "prefix-match" },
  { prefix: "/admin/blogs", kind: "prefix-match" },
  { prefix: "/admin/media", kind: "prefix-match" },
  { prefix: "/admin/content/pricing", kind: "prefix-match" },
  { prefix: "/admin/support-cases", kind: "prefix-match" },
  { prefix: "/admin/jobs", kind: "prefix-match" },
  { prefix: "/admin/settings", kind: "prefix-match" },
  // Admin shell also hosts a generic visitor-detail page for cases
  // where the platform admin needs to see a flagged check-in.
  { prefix: "/admin/visitors", kind: "prefix-match" },
];

export const TENANT_ROUTES: RouteEntry[] = [
  { prefix: "/app/dashboard", kind: "exact" },
  { prefix: "/app/visitors", kind: "prefix-match" },
  { prefix: "/app/appointments", kind: "prefix-match" },
  { prefix: "/app/departments", kind: "prefix-match" },
  { prefix: "/app/branches", kind: "prefix-match" },
  { prefix: "/app/users", kind: "prefix-match" },
  { prefix: "/app/branding", kind: "prefix-match" },
  { prefix: "/app/incidents", kind: "prefix-match" },
  { prefix: "/app/audit", kind: "prefix-match" },
  { prefix: "/app/dpo", kind: "prefix-match" },
  { prefix: "/app/billing", kind: "prefix-match" },
  { prefix: "/app/alerts", kind: "prefix-match" },
  { prefix: "/app/settings", kind: "prefix-match" },
  { prefix: "/app/support-cases", kind: "prefix-match" },
  { prefix: "/app/jobs", kind: "prefix-match" },
  // The backend currently emits support-case links under
  // `/app/admin/support-cases/{id}` for legacy reasons; record the
  // route as known so the resolver isn't accused of producing a
  // ghost URL.
  { prefix: "/app/admin/support-cases", kind: "prefix-match" },
  // Same legacy story for onboarding.
  { prefix: "/app/admin/onboarding", kind: "prefix-match" },
  { prefix: "/app/onboarding", kind: "prefix-match" },
];

export const PUBLIC_ROUTES: RouteEntry[] = [
  { prefix: "/admin/login", kind: "exact" },
  { prefix: "/app/login", kind: "exact" },
  { prefix: "/register", kind: "prefix-match" },
  { prefix: "/checkout", kind: "prefix-match" },
  { prefix: "/rights/request", kind: "prefix-match" },
  { prefix: "/support", kind: "prefix-match" },
];

export type RouteAudience = "admin" | "tenant" | "public";

/**
 * Return true if `path` lands on a registered route for the given
 * audience. Strips query + hash before matching.
 *
 * Audience precedence:
 *   - "admin" → only ADMIN_ROUTES match
 *   - "tenant" → TENANT_ROUTES match (NOT admin — that's how we
 *     forbid `/admin/dashboard` from a tenant notification)
 *   - "public" → PUBLIC_ROUTES match
 */
export function isKnownRoute(
  path: string | null | undefined,
  audience: RouteAudience,
): boolean {
  if (!path) return false;
  const pathname = path.split(/[?#]/)[0];
  const table =
    audience === "admin"
      ? ADMIN_ROUTES
      : audience === "tenant"
        ? TENANT_ROUTES
        : PUBLIC_ROUTES;
  for (const entry of table) {
    if (entry.kind === "exact") {
      if (pathname === entry.prefix) return true;
    } else {
      // Prefix match. We accept both `prefix` exact AND
      // `prefix + "/..."` so a registered `/admin/support-cases`
      // matches `/admin/support-cases/abc123` but not
      // `/admin/support-cases-export`.
      if (pathname === entry.prefix) return true;
      if (pathname.startsWith(entry.prefix + "/")) return true;
    }
  }
  return false;
}
