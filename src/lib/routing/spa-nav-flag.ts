/**
 * Tenant SPA-navigation feature flag.
 *
 * The tenant shell defaults to MPA-style navigation (a full document load
 * on every internal click) because past attempts at App Router client
 * transitions hit a Radix Tooltip portal cleanup race against React 19's
 * reconciler and crashed with `removeChild on null` mid-transition. The
 * MPA fallback is bulletproof but throws away prefetching, shared layout
 * persistence, and the React Query cache on every click.
 *
 * This flag turns the SPA path back on for individual sessions so we can
 * verify the underlying race is fixed in a real browser before flipping
 * the default for everyone.
 *
 * Three layers, checked in this order:
 *   1. URL query param `?spa-nav=on` / `?spa-nav=off`
 *      — Sticky: the choice is persisted to localStorage so the user
 *        doesn't have to keep the param in every URL while testing.
 *   2. `localStorage["visichek-tenant-spa-nav"]` (`"on"` | `"off"`)
 *      — Set automatically by the query-param branch above.
 *   3. `process.env.NEXT_PUBLIC_TENANT_SPA_NAV` (`"on"` to enable)
 *      — Build-time default. Leave unset to keep MPA as the default.
 *
 * The localStorage key is fine here even though we're paranoid about
 * tokens elsewhere: this is a non-sensitive UI preference, not auth state.
 */

const STORAGE_KEY = "visichek-tenant-spa-nav";
const QUERY_PARAM = "spa-nav";

type FlagValue = "on" | "off";

function readQueryOverride(): FlagValue | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(QUERY_PARAM);
  if (raw === "on" || raw === "off") return raw;
  return null;
}

function readStored(): FlagValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "on" || raw === "off") return raw;
  } catch {
    /* Storage may be disabled or quota exceeded — treat as unset. */
  }
  return null;
}

function writeStored(value: FlagValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Best-effort persist. */
  }
}

/**
 * Resolve the tenant SPA-nav flag for the current session.
 *
 * Has the side-effect of persisting an explicit `?spa-nav=on|off` query
 * override to localStorage so the choice survives subsequent navigations.
 * Always returns a boolean — never throws — so call sites can use it
 * inside hot click handlers without try/catch.
 */
export function isTenantSpaNavEnabled(): boolean {
  const queryOverride = readQueryOverride();
  if (queryOverride) {
    writeStored(queryOverride);
    return queryOverride === "on";
  }
  const stored = readStored();
  if (stored) return stored === "on";
  return process.env.NEXT_PUBLIC_TENANT_SPA_NAV === "on";
}

/**
 * Browser-only constant that snapshots the flag at module load. Components
 * that mount once per session (the FullReloadNavInterceptor) use this so
 * they don't have to re-read storage on every click.
 *
 * Server-side this is always `false` — the actual decision happens on
 * mount in the client.
 */
export const TENANT_SPA_NAV_INITIAL: boolean =
  typeof window !== "undefined" ? isTenantSpaNavEnabled() : false;
