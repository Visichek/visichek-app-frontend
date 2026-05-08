"use client";

import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { bootstrapSession } from "@/lib/auth/bootstrap";
import { readAuthHint } from "@/lib/auth/auth-hint";
import { selectIsBootstrapping } from "@/lib/store/session-slice";
import { useAppSelector } from "@/lib/store/hooks";
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

// Auth-fork paths are the public surfaces where a logged-in user should
// NOT see the login chooser/form even briefly. When a localStorage auth
// hint is present we gate these behind the bootstrap spinner so the form
// never flashes before the redirect fires. Other public paths (register,
// checkout, support, ...) keep skipping the gate — they don't redirect
// authenticated users anywhere.
const AUTH_FORK_PATHS = ["/", "/admin/login", "/app/login"];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthForkPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTH_FORK_PATHS.includes(pathname);
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

// BootstrapGate is a child of ReduxProvider so it can read isBootstrapping
// from the store. The bootstrap effect lives in the parent so it fires
// regardless of which UI we render — splash, gate spinner, or children.
function BootstrapGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBootstrapping = useAppSelector(selectIsBootstrapping);

  // Auth hint and PWA standalone checks must be deferred until after the
  // first commit. Reading them during render would cause a hydration
  // mismatch: the server has no localStorage / matchMedia, so SSR renders
  // the public UI, but a client with a hint would render the spinner —
  // and the element trees differ enough that suppressHydrationWarning on
  // <body> can't paper over it. Setting these in useEffect keeps the
  // first client render identical to SSR; the gate engages on the second
  // render, which is fine because bootstrap takes longer than one frame.
  const [hadAuthHintAtMount, setHadAuthHintAtMount] = useState(false);
  const [isPwaStandalone, setIsPwaStandalone] = useState(false);

  useEffect(() => {
    setHadAuthHintAtMount(readAuthHint() !== null);
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      setIsPwaStandalone(window.matchMedia("(display-mode: standalone)").matches);
    }
  }, []);

  // Auth-fork paths only skip the gate when there's no hint, OR when we're
  // in PWA standalone mode (the page renders its own splash). With a hint
  // and no PWA, we wait for bootstrap to either confirm the session (then
  // the page-level redirect fires) or fail (then the hint is cleared by
  // the store subscription and the gate releases).
  const wantsAuthForkGate =
    isAuthForkPath(pathname) && hadAuthHintAtMount && !isPwaStandalone;
  const skipGate = isPublicPath(pathname) && !wantsAuthForkGate;

  if (isBootstrapping && !skipGate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
