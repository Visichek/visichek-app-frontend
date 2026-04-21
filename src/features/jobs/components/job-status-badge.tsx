import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/types/enums";

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "info" }
> = {
  queued: { label: "Queued", variant: "secondary" },
  processing: { label: "Processing", variant: "info" },
  succeeded: { label: "Succeeded", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
