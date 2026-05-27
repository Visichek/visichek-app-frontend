"use client";

import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useHideLocked } from "../hooks/use-hide-locked";
import { useLockedUiAllowed } from "../hooks/use-locked-ui-visibility";

export interface LockedBadgeProps {
  /** "branch" / "department" — used in the tooltip copy. */
  noun: string;
  /** Plan tier that locked this row, e.g. "Free". */
  planLabel?: string;
  className?: string;
}

/**
 * Pill rendered next to a row that exists but is locked under the
 * current plan. Pairs with the `useCapability().isBranchLocked` / the
 * department equivalent: list endpoints still return locked rows so the
 * tenant can see them, but writes against them return 403.
 */
export function LockedBadge({ noun, planLabel = "your current plan", className }: LockedBadgeProps) {
  const { hideLocked } = useHideLocked();
  const lockedUiAllowed = useLockedUiAllowed();
  // Locked affordances only surface on the dashboard; the branches /
  // departments lists that render this badge live elsewhere, so the badge
  // is hidden there. The device-only "Hide locked items" pref also
  // collapses it everywhere it would otherwise show.
  if (!lockedUiAllowed) return null;
  if (hideLocked) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
            className,
          )}
        >
          <Lock className="h-3 w-3" aria-hidden="true" />
          Locked
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        Locked under {planLabel} — upgrade to unlock this {noun}, or delete it
        to free up the slot.
      </TooltipContent>
    </Tooltip>
  );
}
