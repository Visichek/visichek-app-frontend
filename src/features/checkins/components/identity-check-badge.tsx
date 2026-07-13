"use client";

import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { IdentityCheckSummary } from "@/types/checkin";

interface IdentityCheckBadgeProps {
  identityCheck?: IdentityCheckSummary | null;
  /** Fallback when the backend sent no summary (older cached rows). */
  verified: boolean;
  className?: string;
}

/**
 * The verification state of a visitor, and always the reason behind it.
 *
 * A bare "Not verified" is ambiguous: it looks identical whether no ID check
 * ran, the visitor skipped it, or the ID they presented belongs to someone
 * else. Those call for very different responses from the person deciding who
 * walks through the door, so the reason travels with the badge — as a tooltip
 * everywhere, and as visible inline text for the one case that must never be
 * missed: a genuine ID that isn't theirs.
 */
export function IdentityCheckBadge({
  identityCheck,
  verified,
  className,
}: IdentityCheckBadgeProps) {
  // Older cached payloads may predate `identityCheck`. Degrade to the old
  // binary badge rather than render nothing.
  if (!identityCheck) {
    return verified ? (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Verified
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">Not verified</span>
    );
  }

  const { mismatch, verified: isVerified, headline, reason } = identityCheck;

  const Icon = mismatch
    ? ShieldAlert
    : isVerified
      ? ShieldCheck
      : ShieldQuestion;

  const tone = mismatch
    ? "text-destructive font-medium"
    : isVerified
      ? "text-success"
      : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex max-w-[18rem] items-start gap-1 text-xs",
            tone,
            className,
          )}
        >
          <Icon
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          <span className="flex flex-col">
            <span>{headline}</span>
            {/* A mismatch means the ID is real but belongs to someone else.
                That must be readable at a glance, not buried in a tooltip the
                receptionist has to know to hover. */}
            {mismatch && (
              <span className="font-normal leading-snug text-destructive/90">
                {reason}
              </span>
            )}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
