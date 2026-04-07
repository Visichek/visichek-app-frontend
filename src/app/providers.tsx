"use client";

import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState, type ReactNode } from "react";
import { store } from "@/lib/store";
import { Toaster } from "sonner";

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
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: "font-sans",
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
