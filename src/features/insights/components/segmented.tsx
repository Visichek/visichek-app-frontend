"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A labelled group of pill buttons. Used for the range presets, granularity,
 * and role/tab switches on the Insights page.
 */
export function SegmentedControl({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SegmentButton({
  active,
  loading = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  /**
   * Native title (not a Radix Tooltip) is deliberate: these buttons swap the
   * chart subtree, and a portalled Radix Tooltip racing the React 19
   * reconciler on that swap can crash. `title` gives the hover hint safely.
   */
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
