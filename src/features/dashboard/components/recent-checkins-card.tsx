import { format, fromUnixTime } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { RecentCheckIn } from "@/types/dashboard";
import type { VisitStatus } from "@/types/enums";

interface RecentCheckInsCardProps {
  items: RecentCheckIn[];
}

/**
 * Last 10 visitor check-ins, server-capped. Drives the right-hand "live
 * activity" panel in the spec. Shows status, host, company, and either
 * elapsed duration (active visit) or total duration (completed).
 */
export function RecentCheckInsCard({ items }: RecentCheckInsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent check-ins</CardTitle>
        <CardDescription>Latest visitor activity</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="No check-ins yet"
            description="Recent visitor activity will appear here."
          />
        ) : (
          <ul className="divide-y">
            {items.map((item, index) => (
              <li
                key={item.sessionId ? `${item.sessionId}-${index}` : `recent-checkin-${index}`}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-medium">{item.visitorName}</p>
                    {item.verified && (
                      <ShieldCheck
                        className="h-3.5 w-3.5 shrink-0 text-success"
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.company ?? "—"}
                    {item.hostName ? ` · with ${item.hostName}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={statusVariant(item.status)}>
                    {humanizeStatus(item.status)}
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {formatBucket(item)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function statusVariant(status: VisitStatus): BadgeProps["variant"] {
  switch (status) {
    case "checked_in":
      return "success";
    case "checked_out":
      return "secondary";
    case "denied":
      return "destructive";
    case "pending_verification":
    case "registered":
      return "warning";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

function humanizeStatus(status: VisitStatus): string {
  return status.replace(/_/g, " ");
}

function formatBucket(item: RecentCheckIn): string {
  if (item.durationMinutes !== null && item.durationMinutes !== undefined) {
    return `${item.durationMinutes} min`;
  }
  if (item.checkInTime) {
    return format(fromUnixTime(item.checkInTime), "p");
  }
  return "—";
}
