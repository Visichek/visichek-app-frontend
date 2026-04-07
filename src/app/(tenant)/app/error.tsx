"use client";

import { ErrorState } from "@/components/feedback/error-state";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  return (
    <div className="p-6">
      <ErrorState
        title="Application error"
        message={
          error.message || "Failed to load the page. Please try again."
        }
        onRetry={reset}
      />
    </div>
  );
}
