"use client";

import { Clock, CheckCircle2, XCircle, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { CheckinState } from "@/types/checkin";

const STATE_COPY: Record<
  CheckinState,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending_approval: {
    label: "Pending approval",
    icon: Clock,
    className: "bg-warning text-warning-foreground",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-destructive text-destructive-foreground",
  },
  checked_out: {
    label: "Checked out",
    icon: LogOut,
    className: "bg-muted text-muted-foreground",
  },
};

interface CheckinStateBadgeProps {
  state: CheckinState;
  className?: string;
}

/** Compact visual badge for a check-in's current state. */
export function CheckinStateBadge({ state, className }: CheckinStateBadgeProps) {
  const { label, icon: Icon, className: stateClass } = STATE_COPY[state];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-transparent", stateClass, className)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
