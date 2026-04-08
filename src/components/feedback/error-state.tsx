"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPermissionError } from "@/types/api";
import { PermissionDenied } from "@/components/feedback/permission-denied";

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  error,
  onRetry,
}: ErrorStateProps) {
  if (isPermissionError(error)) {
    return <PermissionDenied />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="min-h-[44px]">
          Try again
        </Button>
      )}
    </div>
  );
}
