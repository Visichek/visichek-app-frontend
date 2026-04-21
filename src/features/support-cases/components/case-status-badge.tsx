import { Badge } from "@/components/ui/badge";
import type { SupportCaseStatus } from "@/types/enums";

const LABELS: Record<SupportCaseStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  awaiting_tenant: "Awaiting You",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

function variantFor(status: SupportCaseStatus) {
  switch (status) {
    case "open":
      return "destructive" as const;
    case "acknowledged":
      return "info" as const;
    case "in_progress":
      return "warning" as const;
    case "awaiting_tenant":
      return "warning" as const;
    case "resolved":
      return "success" as const;
    case "closed":
      return "secondary" as const;
    case "reopened":
      return "destructive" as const;
  }
}

export function CaseStatusBadge({ status }: { status: SupportCaseStatus }) {
  return <Badge variant={variantFor(status)}>{LABELS[status]}</Badge>;
}
