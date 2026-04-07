"use client";

import { ErrorState } from "@/components/feedback/error-state";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  return (
    <div className="p-6">
      <ErrorState
        title="Admin dashboard error"
        message={
          error.message || "Failed to load the admin dashboard. Please try again."
        }
        onRetry={reset}
      />
    </div>
  );
}
