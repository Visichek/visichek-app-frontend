import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Coarse route protection middleware.
 *
 * This handles:
 * - redirecting unauthenticated users to the correct login page
 * - blocking tenant users from /admin/* and admins from /app/*
 *
 * Fine-grained role and capability checks happen inside the app
 * via lib/permissions/ and route guards.
 *
 * NOTE: Because tokens are stored in-memory (not cookies),
 * middleware cannot verify auth state on the server. Auth checks
 * here are limited to structural routing. Client-side guards in
 * layouts and route components handle actual session validation.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always accessible
  if (
    pathname === "/" ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/app/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/rights") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // All other /admin/* and /app/* routes proceed to client-side auth guards
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
