import { cn } from "@/lib/utils/cn";
import type { IncidentRiskLevel } from "@/types/incident";

const LABELS: Record<IncidentRiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const DOT: Record<IncidentRiskLevel, string> = {
  low: "bg-muted-foreground/50",
  medium: "bg-info",
  high: "bg-warning",
  critical: "bg-destructive",
};

/**
 * A quiet risk cue — a small colored dot + label — so Status stays the single
 * filled badge in a list row and risk doesn't compete with it for the eye.
 * Mirrors the support-cases `CasePriorityDot`.
 */
export function IncidentRiskDot({
  risk,
  className,
}: {
  risk?: IncidentRiskLevel | null;
  className?: string;
}) {
  if (!risk) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", DOT[risk])}
        aria-hidden="true"
      />
      <span>{LABELS[risk]}</span>
    </span>
  );
}
