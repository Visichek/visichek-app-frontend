"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpgradePrompt } from "./upgrade-prompt-provider";
import { useHideLocked } from "../hooks/use-hide-locked";
import { useLockedUiAllowed } from "../hooks/use-locked-ui-visibility";
import type { PlanFeatureKey } from "@/types/billing";

export interface LockedOverlayProps {
  /** Render children blurred + behind a padlock when true; pass-through otherwise. */
  locked: boolean;
  children: ReactNode;
  /** Feature key for the upgrade modal copy. */
  featureKey?: PlanFeatureKey | string | null;
  /** Override the modal headline (defaults to the feature copy). */
  title?: string;
  /**
   * Optional inline label shown on the overlay button. Defaults to
   * "Upgrade to unlock". Set to `null` to render only the padlock icon.
   */
  ctaLabel?: string | null;
  /** Extra classes applied to the outer relative wrapper. */
  className?: string;
}

/**
 * Wraps any block of UI so that, when `locked` is true, the children render
 * blurred and behind a clickable overlay with a padlock. Clicking opens the
 * shared upgrade modal pre-keyed to `featureKey`.
 *
 * Only renders on the dashboard (see `useLockedUiAllowed`) — on every other
 * route a locked section is hidden entirely. Used for plan-gated dashboard
 * cards, tabs, and stats where the user should see "this exists, upgrade to
 * use it" rather than the destination being silently hidden.
 */
export function LockedOverlay({
  locked,
  children,
  featureKey,
  title,
  ctaLabel = "Upgrade to unlock",
  className,
}: LockedOverlayProps) {
  const { promptUpgrade } = useUpgradePrompt();
  const { hideLocked } = useHideLocked();
  const lockedUiAllowed = useLockedUiAllowed();

  if (!locked) return <>{children}</>;
  // Locked features only surface on the dashboard. On every other route we
  // render nothing — no blur preview, no padlock — so the surrounding
  // layout closes the gap naturally.
  if (!lockedUiAllowed) return null;
  // Device-only opt-in: free-plan users can collapse padlocks out of
  // their UI for up to 4 hours via the "Hide locked items" pref.
  if (hideLocked) return null;

  return (
    <div className={cn("relative isolate", className)}>
      {/* Frozen, blurred preview — pointer-events-none so the overlay
          captures every interaction. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[3px] opacity-60"
      >
        {children}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() =>
              promptUpgrade({
                featureKey: featureKey ?? null,
                title,
              })
            }
            aria-label={title ? `${title} — upgrade to unlock` : "Upgrade to unlock this section"}
            className={cn(
              "group/lock absolute inset-0 z-base flex flex-col items-center justify-center gap-2 rounded-xl",
              "bg-background/40 backdrop-blur-[2px]",
              "transition-colors hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
              "dark:bg-background/30 dark:hover:bg-background/50",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-300/60 shadow-sm",
                "dark:bg-amber-500/15 dark:ring-amber-400/40",
              )}
            >
              <Lock
                className="h-5 w-5 text-amber-700 dark:text-amber-300"
                aria-hidden="true"
              />
            </span>
            {ctaLabel && (
              <span className="rounded-full bg-amber-100/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 shadow-sm dark:bg-amber-500/20 dark:text-amber-200">
                {ctaLabel}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          {title
            ? `${title} is part of the paid plans. Click to see what an upgrade unlocks.`
            : "Upgrade your plan to unlock this section."}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
