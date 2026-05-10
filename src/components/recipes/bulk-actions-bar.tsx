"use client";

import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface BulkAction {
  label: string;
  description: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary";
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
  /**
   * What is being selected, plural noun. Used in the live region announcement
   * and the count label, e.g. "3 plans selected".
   */
  itemNoun?: string;
}

export function BulkActionsBar({
  selectedCount,
  onClear,
  actions,
  className,
  itemNoun,
}: BulkActionsBarProps) {
  if (selectedCount <= 0) return null;

  const countLabel = itemNoun
    ? `${selectedCount} ${itemNoun}${selectedCount === 1 ? "" : "s"} selected`
    : `${selectedCount} selected`;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "sticky top-0 z-sticky flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" aria-live="polite">
          {countLabel}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-9 gap-1.5"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Deselect all currently selected items
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={action.variant ?? "default"}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled || action.isLoading}
                className="min-h-[44px] gap-2 md:min-h-0"
              >
                {action.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  action.icon
                )}
                <span>{action.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{action.description}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
