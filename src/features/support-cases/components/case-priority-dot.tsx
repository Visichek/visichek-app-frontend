import { cn } from "@/lib/utils/cn";
import type { SupportCasePriority } from "@/types/enums";

const LABELS: Record<SupportCasePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const DOT: Record<SupportCasePriority, string> = {
  low: "bg-muted-foreground/50",
  medium: "bg-info",
  high: "bg-warning",
  critical: "bg-destructive",
};

/**
 * A quiet priority cue — a small colored dot + label. Used in list rows so
 * Status stays the single filled badge and priorities don't compete with it
 * for the eye.
 */
export function CasePriorityDot({
  priority,
  className,
}: {
  priority: SupportCasePriority;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", DOT[priority])}
        aria-hidden="true"
      />
      <span>{LABELS[priority]}</span>
    </span>
  );
}
