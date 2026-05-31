"use client";

import { Clock } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { formatRelative } from "@/lib/utils/format-date";

/**
 * Response-SLA countdown chip. Amber within 24h, red once overdue, muted
 * otherwise. Reads `slaDueAt` (unix epoch seconds).
 */
export function SlaChip({ slaDueAt }: { slaDueAt: number }) {
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = slaDueAt - now;
  const absSeconds = Math.abs(secondsLeft);
  const hoursLeft = Math.floor(absSeconds / 3600);
  const overdue = secondsLeft < 0;
  // Under an hour, hours floor to 0 and "0h" reads as on-time — fall back to
  // minutes so a near/just-passed deadline still reads as urgent.
  const subHour = hoursLeft === 0;
  const minutesLeft = Math.max(1, Math.floor(absSeconds / 60));

  const tone = overdue
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : hoursLeft < 24
      ? "border-warning/50 bg-warning/10 text-warning"
      : "border-border bg-muted/50 text-muted-foreground";

  const label = overdue
    ? subHour
      ? `SLA overdue by ${minutesLeft}m`
      : `SLA overdue by ${hoursLeft}h`
    : subHour
      ? `SLA in ${minutesLeft}m`
      : hoursLeft < 24
        ? `SLA in ${hoursLeft}h`
        : `SLA ${formatRelative(slaDueAt)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Response SLA deadline based on the tenant&apos;s support tier
      </TooltipContent>
    </Tooltip>
  );
}
