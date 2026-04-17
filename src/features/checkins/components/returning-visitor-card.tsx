"use client";

import { UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VisitorOut } from "@/types/checkin";

interface ReturningVisitorCardProps {
  visitor: VisitorOut;
  onUseProfile: () => void;
  onDismiss: () => void;
}

/**
 * Shown when the returning-visitor lookup finds a match. The visitor
 * can confirm ("Yes, that's me") to prefill the form, or dismiss to
 * enter as a new visitor.
 */
export function ReturningVisitorCard({
  visitor,
  onUseProfile,
  onDismiss,
}: ReturningVisitorCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {visitor.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visitor.portraitUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover border"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <UserCheck
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Welcome back!</p>
          <p className="text-sm text-muted-foreground truncate">
            {visitor.fullName}
          </p>
          {visitor.verified && (
            <p className="text-xs text-success mt-0.5">
              Identity previously verified
            </p>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              aria-label="Not me"
              className="min-h-[44px] min-w-[44px]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            This is not me — continue as a new visitor
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onUseProfile}
              className="flex-1 min-h-[44px]"
            >
              Yes, that&apos;s me
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Prefill the rest of the form from your saved profile
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
