"use client";

import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { bootstrapSession } from "@/lib/auth/bootstrap";
import { Toaster, toast } from "sonner";
import { isPermissionError } from "@/types/api";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NavigationLoadingProvider } from "@/lib/routing/navigation-context";
import { NavigationOverlay } from "@/components/feedback/navigation-overlay";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

interface ProvidersProps {
  children: ReactNode;
}

// Public paths render immediately without waiting on bootstrapSession() —
// they don't need session info to be useful, and gating them on the boot
// chain meant a stalled /me or /auth/refresh would lock the user out of
// even the login page (the spinner from this Providers gate had no console
// output, so it looked like a dead app). Authenticated shells still wait
// because their AuthGuard would otherwise see isAuthenticated=false during
// the bootstrap window and bounce to login.
const PUBLIC_PATH_PREFIXES = [
  "/admin/login",
  "/app/login",
  "/register",
  "/checkout",
  "/rights",
  "/support",
  "/app/scan",
  "/app/select-tenant",
  "/offline",
];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error) => {
              // Never retry 403 — it won't resolve on retry
              if (isPermissionError(error)) return false;
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
            onError: (error) => {
              if (isPermissionError(error)) {
                toast.error("Insufficient permissions — you do not have access to this feature.");
              }
            },
          },
        },
      })
  );

  const pathname = usePathname();
  const skipGate = isPublicPath(pathname);

  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    bootstrapSession().finally(() => setIsBootstrapping(false));
  }, []);

  // Workaround for a corrupted React reconciler (the `removeChild` crashes
  // surfaced in the console freeze the client-side router — the URL updates
  // but the new page tree never commits). Forcing a hard reload on every
  // pathname change guarantees the destination renders. Skip the very first
  // render so we don't reload on mount.
  const previousPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname;
      return;
    }
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      window.location.reload();
    }
  }, [pathname]);

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={250} skipDelayDuration={150} disableHoverableContent>
            <NavigationLoadingProvider>
              {isBootstrapping && !skipGate ? (
                <div className="flex min-h-screen items-center justify-center bg-background">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                </div>
              ) : (
                children
              )}
              <NavigationOverlay />
              <ServiceWorkerRegister />
              <Toaster
                position="top-right"
                toastOptions={{
                  className: "font-sans",
                }}
              />
            </NavigationLoadingProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
