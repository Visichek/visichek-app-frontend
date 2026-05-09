"use client";

import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { bootstrapSession } from "@/lib/auth/bootstrap";
import { selectIsBootstrapping } from "@/lib/store/session-slice";
import { useAppSelector } from "@/lib/store/hooks";
import { Toaster, toast } from "sonner";
import { isPermissionError } from "@/types/api";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NavigationLoadingProvider } from "@/lib/routing/navigation-context";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

interface ProvidersProps {
  children: ReactNode;
}

// Public paths render immediately without waiting on bootstrapSession() —
// they don't need session info to be useful, and gating them on the boot
// chain meant a stalled /me or /auth/refresh would lock the user out of
// even the login page. Authenticated shells still wait because their
// AuthGuard would otherwise see isAuthenticated=false during the bootstrap
// window and bounce to login.
//
// Login pages (`/admin/login`, `/app/login`) ALWAYS skip the gate. The
// previous "auth-fork" carve-out used a localStorage hint to gate the
// login pages behind the spinner so an already-logged-in user wouldn't
// briefly see the login form. In practice that created a deadlock window:
// if `/me` was slow or refresh failed, the user stared at a spinner with
// no way out. Each login page already runs `useRedirectIfAuthenticated`,
// which is a sufficient (and recoverable) defense against the form-flash.
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

  useEffect(() => {
    bootstrapSession();
  }, []);

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={250} skipDelayDuration={150} disableHoverableContent>
            <NavigationLoadingProvider>
              <BootstrapGate>{children}</BootstrapGate>
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

// BootstrapGate is a child of ReduxProvider so it can read isBootstrapping
// from the store. The bootstrap effect lives in the parent so it fires
// regardless of which UI we render — splash, gate spinner, or children.
function BootstrapGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBootstrapping = useAppSelector(selectIsBootstrapping);

  if (isBootstrapping && !isPublicPath(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
