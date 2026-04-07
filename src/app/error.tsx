"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/error-state";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <ErrorState
        title="Something went wrong"
        message={error.message || "An unexpected error occurred. Please try again."}
        onRetry={reset}
      />
    </div>
  );
}
