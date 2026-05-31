"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

/**
 * "Filters" disclosure — a single trigger (with an active-count badge) that
 * opens a side sheet holding the secondary filters, so the list page shows a
 * search bar + a primary control instead of a wall of dropdowns.
 */
export function FilterSheet({
  activeCount,
  children,
  onClear,
  description = "Narrow the list. Changes apply immediately.",
}: {
  activeCount: number;
  children: ReactNode;
  onClear?: () => void;
  description?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setOpen(true)}
            aria-label={
              activeCount > 0
                ? `Open filters, ${activeCount} active`
                : "Open filters"
            }
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Refine the list with the secondary filters and sort order
        </TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5">{children}</div>
          {onClear && activeCount > 0 && (
            <div className="mt-6">
              <Button
                type="button"
                variant="ghost"
                className="w-full min-h-[44px]"
                onClick={onClear}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
