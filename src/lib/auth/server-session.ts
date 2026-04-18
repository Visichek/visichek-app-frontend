/**
 * Server-only. Do NOT import from client components.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { serverApiGet, serverApiPost } from "@/lib/api/server-client";

/**
 * ⚠️  Known blocker (2026-04): this helper cannot currently obtain an access
 * token on the server because the httpOnly auth cookies are set on the API
 * origin (api.visichek.app), not on the frontend's own domain. Next.js'
 * `cookies()` only sees cookies scoped to the frontend domain.
 *
 * To make server-side auth work, one of these must happen first:
 *   1. Introduce a BFF session cookie on the frontend domain whose server
 *      can exchange for an API access token.
 *   2. Proxy API calls through Next.js route handlers that keep a session
 *      server-side.
 *   3. Host the frontend and API under a shared parent domain so a single
 *      cookie can be read by both.
 *
 * Until one of those lands, this helper returns `null` and callers should
 * gracefully skip prefetching — the client hooks will still fetch normally.
 *
 * When you resolve the blocker, fix the TODO below and the helper becomes
 * live across every page that uses `ssrPrefetch`.
 */

export interface ServerSession {
  accessToken: string;
  /** Forwarded cookie header — pass this into server API calls. */
  cookieHeader: string;
}

/**
 * Read the cookie header from the incoming request and forward it to the
 * unified refresh endpoint to obtain an access token for server-side use.
 *
 * Memoised per-request via React's `cache()` so multiple prefetches in one
 * render hit `/auth/refresh` at most once.
 */
export const getServerSession = cache(
  async (): Promise<ServerSession | null> => {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // TODO: when the cookie-domain blocker is resolved, this header will
    // carry the refresh token and the call below will succeed.
    if (!cookieHeader) return null;

    try {
      const data = await serverApiPost<{
        accessToken?: string;
        access_token?: string;
      }>("/auth/refresh", {}, { cookieHeader });

      const accessToken = data.accessToken ?? data.access_token ?? "";
      if (!accessToken) return null;

      return { accessToken, cookieHeader };
    } catch {
      // Refresh failed — caller should skip prefetch and let the client
      // handle auth via its own refresh/login flow.
      return null;
    }
  }
);

export interface ServerTenantSession extends ServerSession {
  tenantId: string;
  role: string;
  userId: string;
}

/**
 * Session + tenant profile for the tenant shell. Calls `/system-users/me`
 * to resolve `tenantId` and `role`, which server components need to scope
 * prefetches (invoices, active subscription, etc).
 *
 * Memoised alongside `getServerSession` so a page rendering many prefetches
 * hits this path at most once. Returns `null` for the same reasons as
 * `getServerSession`, or if the caller isn't a tenant user (e.g. platform
 * admin — use a separate admin helper there).
 *
 * A follow-up optimisation would be a dedicated `tenant_id` cookie on
 * `.visichek.app` so this avoids the extra `/system-users/me` round trip.
 */
export const getServerTenantSession = cache(
  async (): Promise<ServerTenantSession | null> => {
    const session = await getServerSession();
    if (!session) return null;

    try {
      const profile = await serverApiGet<{
        id?: string;
        role?: string;
        tenantId?: string;
        tenant_id?: string;
      }>("/system-users/me", { accessToken: session.accessToken });

      const tenantId = profile.tenantId ?? profile.tenant_id ?? "";
      if (!tenantId || !profile.role) return null;

      return {
        ...session,
        tenantId,
        role: profile.role,
        userId: profile.id ?? "",
      };
    } catch {
      return null;
    }
  }
);

export interface ServerAdminSession extends ServerSession {
  userId: string;
  email: string;
}

/**
 * Session + admin profile for the platform-admin shell. Calls
 * `/admins/profile` to resolve the current admin user.
 *
 * Memoised alongside `getServerSession` / `getServerTenantSession`.
 * Returns `null` if refresh fails or the caller isn't an admin session
 * (e.g. tenant users).
 */
export const getServerAdminSession = cache(
  async (): Promise<ServerAdminSession | null> => {
    const session = await getServerSession();
    if (!session) return null;

    try {
      const profile = await serverApiGet<{
        id?: string;
        email?: string;
      }>("/admins/profile", { accessToken: session.accessToken });

      if (!profile.id) return null;

      return {
        ...session,
        userId: profile.id,
        email: profile.email ?? "",
      };
    } catch {
      return null;
    }
  }
);
