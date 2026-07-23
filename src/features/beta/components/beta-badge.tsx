"use client";

import { FlaskConical } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Small pill marking a page or panel as an early-access (beta) design.
 * The tooltip tells the user where the opt-out lives so the badge doubles
 * as the escape-hatch signpost.
 */
export function BetaBadge({
  className,
  hint,
}: {
  className?: string;
  /** Override the default "where to turn this off" tooltip copy. */
  hint?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary",
            className,
          )}
        >
          <FlaskConical className="h-3 w-3" aria-hidden="true" />
          Beta
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {hint ??
          "You're seeing an early-access design. It can be turned off any time from Settings → Advanced → Beta features."}
      </TooltipContent>
    </Tooltip>
  );
}
