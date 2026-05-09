import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware (Next 16 renamed `middleware.ts` → `proxy.ts`).
 *
 * Auth enforcement here is intentionally a no-op. The httpOnly auth cookies
 * are set by the backend on the API origin (api.visichek.app), not on the
 * frontend's own domain — so `request.cookies.get(...)` running here on the
 * frontend's edge runtime cannot see them. Any code that tried to read them
 * would always observe "no session" and redirect every refreshed page to
 * the login screen, which is exactly the regression we just unwound.
 *
 * The same architectural constraint is documented in
 * `src/lib/auth/server-session.ts` for the server prefetch helpers.
 *
 * Auth is enforced client-side instead:
 *   - `bootstrapSession()` calls `/v1/me` on app boot (cookies travel
 *     cross-origin via `withCredentials`) and hydrates Redux.
 *   - Shell-level `AuthGuard` components redirect to login if the
 *     bootstrap result is unauthenticated.
 *   - The axios response interceptor refreshes once on 401 and clears
 *     session + redirects on refresh failure.
 *
 * If/when the cookie story changes (BFF session cookie on the frontend
 * domain, shared parent domain, or proxied API), reintroduce the edge
 * checks here — but only after the cookies are actually visible to this
 * runtime.
 */

export function proxy(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
