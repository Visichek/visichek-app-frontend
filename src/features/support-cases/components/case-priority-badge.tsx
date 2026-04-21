import { Badge } from "@/components/ui/badge";
import type { SupportCasePriority } from "@/types/enums";

const LABELS: Record<SupportCasePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function variantFor(priority: SupportCasePriority) {
  switch (priority) {
    case "low":
      return "secondary" as const;
    case "medium":
      return "info" as const;
    case "high":
      return "warning" as const;
    case "critical":
      return "destructive" as const;
  }
}

export function CasePriorityBadge({ priority }: { priority: SupportCasePriority }) {
  return <Badge variant={variantFor(priority)}>{LABELS[priority]}</Badge>;
}
