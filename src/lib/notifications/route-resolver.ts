/**
 * Notification → route resolver (Issue 2).
 *
 * The backend emits notification `link` fields as tenant-shell paths
 * (e.g. `/app/checkins/{id}`, `/app/admin/onboarding/{id}`). The
 * frontend needs ONE canonical place to turn those into the right
 * destination for the current shell, so the topbar dropdown, the
 * sidebar badge taps, the command launcher, and dashboard "attention"
 * cards all open the same page for the same notification.
 *
 * The previous inline normalizer in `notification-dropdown.tsx` had two
 * known bugs that this module fixes:
 *
 *   1. Support cases were emitted at `/app/admin/support-cases/{id}` —
 *      a simple `/app/` → `/admin/` rewrite produced
 *      `/admin/admin/support-cases/...` (doubled admin prefix).
 *
 *   2. Onboarding notifications targeted `/app/admin/onboarding/{id}`,
 *      but the actual platform-admin route is
 *      `/admin/tenants/onboarding/{id}`.
 *
 * Both are corrected by the path table below.
 */

/** Audience the link is being resolved for. */
export type RouteAudience = "admin" | "tenant";

/**
 * Rewrite rules applied IN ORDER. The first prefix match wins; the
 * rest of the path is preserved. `byAudience` lets a single backend
 * path land on the correct shell-specific route.
 *
 * When adding a rewrite, add the rule, then add a route-existence
 * test in `route-resolver.test.ts` (TODO) so a backend service that
 * emits a stale link is caught before it reaches users.
 */
interface Rewrite {
  from: string;
  byAudience: Record<RouteAudience, string>;
}

const REWRITES: Rewrite[] = [
  // Support cases — backend emits a tenant-shaped admin URL.
  // Tenant shell keeps the same path; platform admin lands on the
  // direct /admin/support-cases/{id} route (NOT /admin/admin/...).
  {
    from: "/app/admin/support-cases/",
    byAudience: {
      admin: "/admin/support-cases/",
      tenant: "/app/admin/support-cases/",
    },
  },
  // Onboarding — backend emits /app/admin/onboarding/{id}; the actual
  // admin route is /admin/tenants/onboarding/{id}.
  {
    from: "/app/admin/onboarding",
    byAudience: {
      admin: "/admin/tenants/onboarding",
      tenant: "/app/admin/onboarding",
    },
  },
  // Visitor approvals are emitted at /app/checkins/{id} but the
  // tenant-facing detail route is /app/visitors/{id}. Admins get the
  // tenant detail page rewritten into the admin shell only as a
  // last resort — there isn't an admin-specific visitor detail page.
  {
    from: "/app/checkins/",
    byAudience: {
      admin: "/admin/visitors/",
      tenant: "/app/visitors/",
    },
  },
];

/**
 * Notification buckets the sidebar can badge.
 *
 * Keep in sync with `SidebarNotificationBucket` in
 * `components/navigation/app-sidebar.tsx`. The duplication is
 * intentional: the sidebar type is the UI contract, this type is the
 * data contract, and the resolver enforces that every URL we emit
 * maps to a known bucket so badge counts can be reconciled with a
 * destination.
 */
export type NotificationBucket =
  | "visitors"
  | "appointments"
  | "onboarding_queue"
  | "support_cases"
  | "jobs"
  | "incidents"
  | "content"
  | "billing"
  | "plans"
  | "pricing";

/**
 * Match a resolved path to its sidebar bucket. Used by the dashboard
 * attention panel and the command launcher to label which sidebar
 * row owns a given notification.
 */
const BUCKET_PATTERNS: Array<{
  bucket: NotificationBucket;
  test: (path: string) => boolean;
}> = [
  { bucket: "support_cases", test: (p) => p.includes("/support-cases") },
  {
    bucket: "onboarding_queue",
    test: (p) =>
      p.includes("/tenants/onboarding") || p.includes("/admin/onboarding"),
  },
  { bucket: "visitors", test: (p) => p.includes("/visitors") || p.includes("/checkins") },
  { bucket: "appointments", test: (p) => p.includes("/appointments") },
  { bucket: "incidents", test: (p) => p.includes("/incidents") },
  { bucket: "jobs", test: (p) => p.includes("/jobs") },
  { bucket: "plans", test: (p) => p.includes("/plans") },
  { bucket: "pricing", test: (p) => p.includes("/pricing") },
  { bucket: "billing", test: (p) => p.includes("/billing") || p.includes("/subscriptions") },
  { bucket: "content", test: (p) => p.includes("/blogs") || p.includes("/media") || p.includes("/content") },
];

export function resolveNotificationBucket(
  path: string | null | undefined,
): NotificationBucket | null {
  if (!path) return null;
  for (const p of BUCKET_PATTERNS) {
    if (p.test(path)) return p.bucket;
  }
  return null;
}

function safeParse(href: string): URL | null {
  if (!href) return null;
  const base =
    typeof window === "undefined"
      ? "https://client.visichek.app"
      : window.location.origin;
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

/**
 * Resolve a backend-emitted notification link into a same-origin path
 * the current shell can navigate to. Returns `null` when the link
 * points off-origin (notifications should never open another origin
 * silently) or is malformed.
 *
 * @param link Backend `notification.link`. Can be relative or absolute.
 * @param audience Which shell the user is currently in.
 */
export function resolveNotificationRoute(
  link: string | null | undefined,
  audience: RouteAudience,
): string | null {
  if (!link) return null;

  const url = safeParse(link);
  if (!url) return null;

  if (
    typeof window !== "undefined" &&
    url.origin !== window.location.origin &&
    url.origin !== "https://client.visichek.app"
  ) {
    return null;
  }

  let pathname = url.pathname;

  // Apply the explicit rewrite table first — these are the patterns
  // that previously generated /admin/admin/... or pointed at routes
  // that don't exist in the admin shell.
  for (const rule of REWRITES) {
    if (pathname.startsWith(rule.from)) {
      const target = rule.byAudience[audience];
      pathname = target + pathname.slice(rule.from.length);
      // Guard: a buggy rewrite could still produce /admin/admin/... —
      // collapse the doubled prefix as a last line of defense.
      pathname = pathname.replace(/^\/admin\/admin\//, "/admin/");
      pathname = pathname.replace(/^\/app\/app\//, "/app/");
      return `${pathname}${url.search}${url.hash}`;
    }
  }

  // No specific rule — generic shell swap for `/app/*` ↔ `/admin/*`.
  // Skip the swap if the path is already shell-correct.
  if (audience === "admin" && pathname.startsWith("/app/")) {
    pathname = "/admin/" + pathname.slice("/app/".length);
  } else if (audience === "tenant" && pathname.startsWith("/admin/")) {
    // Don't auto-rewrite admin URLs for tenant users — they shouldn't
    // have admin notifications, and silently sending them to /app/*
    // could land on a 404. Return null and let the UI fall back to
    // "no destination".
    return null;
  }

  // Final guard against double-prefixing.
  pathname = pathname.replace(/^\/admin\/admin\//, "/admin/");
  pathname = pathname.replace(/^\/app\/app\//, "/app/");

  return `${pathname}${url.search}${url.hash}`;
}
