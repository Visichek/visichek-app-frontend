"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Filter editor that floats in front of the page on a blurred backdrop. The
 * filter controls are passed as `children` so both the platform and tenant
 * dashboards reuse the same shell. Edits apply live; closing leaves the chosen
 * filters visible as chips below the range bar. Closes on backdrop click, the
 * X, "Done", or Escape.
 */
export function FilterOverlay({
  open,
  onClear,
  onClose,
  children,
}: {
  open: boolean;
  onClear: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center bg-background/60 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
      onClick={onClose}
    >
      <div
        className="mt-[10vh] w-full max-w-xl rounded-xl border border-border bg-popover p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Filters</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close filters">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {children}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClear} title="Clear every active filter">
            Clear all
          </Button>
          <Button size="sm" onClick={onClose} title="Apply and close">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
