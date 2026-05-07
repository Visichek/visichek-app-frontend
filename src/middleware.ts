import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PATHS } from "@/lib/routing/paths";

/**
 * Edge auth middleware.
 *
 * Tokens live in httpOnly cookies set by the backend. This middleware:
 *   1. lets through public routes
 *   2. for any private route, reads the access cookie and decodes its
 *      claims (no signature verification — the backend re-verifies on
 *      every API call)
 *   3. if the access cookie is missing/expired, calls the backend refresh
 *      endpoint server-side and forwards the rotated Set-Cookie headers
 *   4. if refresh fails or there is nothing to refresh, redirects to the
 *      correct login page and clears the auth cookies on the response
 *   5. enforces shell boundaries: platform admins out of /app/*, tenant
 *      users out of /admin/*
 *
 * Fine-grained capability checks live in lib/permissions/ and run inside
 * the shell — middleware deliberately stays at the routing level.
 */

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ADMIN_REFRESH_PATH = "/admins/refresh";
const SYSTEM_USER_REFRESH_PATH = "/system-users/refresh";

type Shell = "admin" | "tenant";

interface TokenClaims {
  role?: string;
  session_type?: string;
  tenant_id?: string;
  tenantId?: string;
  exp?: number;
}

interface RefreshResult {
  setCookies: string[];
  newAccess: string | null;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === PATHS.ADMIN_LOGIN ||
    pathname === PATHS.APP_LOGIN ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/rights") ||
    pathname.startsWith("/support") ||
    pathname === "/app/scan" ||
    pathname.startsWith("/app/scan/") ||
    pathname === "/app/select-tenant" ||
    pathname.startsWith("/app/select-tenant/")
  );
}

function getShellForPath(pathname: string): Shell | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "tenant";
  return null;
}

function getLoginPathForShell(shell: Shell): string {
  return shell === "admin" ? PATHS.ADMIN_LOGIN : PATHS.APP_LOGIN;
}

function decodeJwtPayload(token: string): TokenClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

function isExpired(claims: TokenClaims): boolean {
  if (typeof claims.exp !== "number") return false;
  return claims.exp * 1000 < Date.now() - 10_000;
}

function isAdminClaims(claims: TokenClaims): boolean {
  return claims.role === "admin" || claims.session_type === "admin";
}

async function refreshSession(
  request: NextRequest,
  shell: Shell,
): Promise<RefreshResult | null> {
  if (!API_BASE_URL) return null;

  const path = shell === "admin" ? ADMIN_REFRESH_PATH : SYSTEM_USER_REFRESH_PATH;
  const url = `${API_BASE_URL}${path}`;
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return null;

    const headers = res.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : (() => {
            const single = res.headers.get("set-cookie");
            return single ? [single] : [];
          })();

    let newAccess: string | null = null;
    for (const c of setCookies) {
      const m = c.match(new RegExp(`(?:^|; *)${ACCESS_COOKIE}=([^;]*)`));
      if (m) {
        newAccess = decodeURIComponent(m[1]);
        break;
      }
    }

    return { setCookies, newAccess };
  } catch {
    return null;
  }
}

function applySetCookies(response: NextResponse, setCookies: string[]): void {
  for (const c of setCookies) {
    response.headers.append("set-cookie", c);
  }
}

function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}

function redirectToLogin(
  request: NextRequest,
  shell: Shell,
  options: { clearCookies: boolean },
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = getLoginPathForShell(shell);
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  if (options.clearCookies) clearAuthCookies(response);
  return response;
}

function redirectToShellDashboard(
  request: NextRequest,
  target: Shell,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname =
    target === "admin" ? PATHS.ADMIN_DASHBOARD : PATHS.APP_DASHBOARD;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const shell = getShellForPath(pathname);
  if (!shell) {
    return NextResponse.next();
  }

  let access = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value ?? null;
  const response = NextResponse.next();

  if (!access) {
    if (!refresh) {
      return redirectToLogin(request, shell, { clearCookies: false });
    }
    const result = await refreshSession(request, shell);
    if (!result || !result.newAccess) {
      return redirectToLogin(request, shell, { clearCookies: true });
    }
    applySetCookies(response, result.setCookies);
    access = result.newAccess;
  }

  let claims = decodeJwtPayload(access);
  if (!claims) {
    return redirectToLogin(request, shell, { clearCookies: true });
  }

  if (isExpired(claims)) {
    if (!refresh) {
      return redirectToLogin(request, shell, { clearCookies: true });
    }
    const result = await refreshSession(request, shell);
    if (!result || !result.newAccess) {
      return redirectToLogin(request, shell, { clearCookies: true });
    }
    applySetCookies(response, result.setCookies);
    const refreshed = decodeJwtPayload(result.newAccess);
    if (!refreshed) {
      return redirectToLogin(request, shell, { clearCookies: true });
    }
    claims = refreshed;
  }

  const userIsAdmin = isAdminClaims(claims);
  if (shell === "admin" && !userIsAdmin) {
    return redirectToShellDashboard(request, "tenant");
  }
  if (shell === "tenant" && userIsAdmin) {
    return redirectToShellDashboard(request, "admin");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - _next/static, _next/image, favicon.ico
     * - any path that looks like a file (contains a dot)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
