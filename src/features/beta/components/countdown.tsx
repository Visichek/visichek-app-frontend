"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format-date";

export type CountdownUrgency = "overdue" | "urgent" | "normal";

function urgencyFor(
  secondsLeft: number,
  warnUnderSeconds: number,
): CountdownUrgency {
  if (secondsLeft <= 0) return "overdue";
  if (secondsLeft < warnUnderSeconds) return "urgent";
  return "normal";
}

function formatLeft(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  const seconds = Math.floor(s % 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const URGENCY_CLASSES: Record<CountdownUrgency, string> = {
  overdue: "text-destructive",
  urgent: "text-warning",
  normal: "text-muted-foreground",
};

interface CountdownProps {
  /** Deadline as unix epoch seconds. */
  deadline: number;
  /** Below this many seconds remaining the countdown turns amber. */
  warnUnderSeconds?: number;
  /** Label rendered once the deadline passes. */
  overdueLabel?: string;
  className?: string;
}

/**
 * Live-ticking time-remaining label (1s cadence). Colors follow status
 * tokens: overdue = destructive, inside the warning window = warning.
 * Unlike the static SLA chips, this re-renders itself — no refetch needed.
 */
export function Countdown({
  deadline,
  warnUnderSeconds = 6 * 3600,
  overdueLabel = "Overdue",
  className,
}: CountdownProps) {
  const [nowSeconds, setNowSeconds] = useState(() =>
    Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    const id = window.setInterval(
      () => setNowSeconds(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  const secondsLeft = deadline - nowSeconds;
  const urgency = urgencyFor(secondsLeft, warnUnderSeconds);
  const overdueBySeconds = Math.abs(secondsLeft);

  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        URGENCY_CLASSES[urgency],
        className,
      )}
      title={formatDateTime(deadline)}
      aria-live="off"
    >
      {urgency === "overdue"
        ? `${overdueLabel} by ${formatLeft(overdueBySeconds)}`
        : formatLeft(secondsLeft)}
    </span>
  );
}
