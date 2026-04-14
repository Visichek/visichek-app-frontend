"use client";

import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState, useEffect, type ReactNode } from "react";
import { store } from "@/lib/store";
import { bootstrapSession } from "@/lib/auth/bootstrap";
import { Toaster, toast } from "sonner";
import { isPermissionError } from "@/types/api";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NavigationLoadingProvider } from "@/lib/routing/navigation-context";
import { NavigationOverlay } from "@/components/feedback/navigation-overlay";

interface ProvidersProps {
  children: ReactNode;
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

  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    bootstrapSession().finally(() => setIsBootstrapping(false));
  }, []);

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <NavigationLoadingProvider>
              {isBootstrapping ? (
                <div className="flex min-h-screen items-center justify-center bg-background">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                </div>
              ) : (
                children
              )}
              <NavigationOverlay />
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
