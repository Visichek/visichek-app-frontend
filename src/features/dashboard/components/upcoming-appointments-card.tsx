import { format, fromUnixTime } from "date-fns";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { UpcomingAppointment } from "@/types/dashboard";
import type { AppointmentStatus } from "@/types/enums";

interface UpcomingAppointmentsCardProps {
  /**
   * Today's upcoming appointments (server-capped at 10). Accepts
   * `null`/`undefined` because the Free-plan dashboard payload nulls
   * `upcomingAppointmentsToday` by design.
   */
  items: UpcomingAppointment[] | null | undefined;
}

/**
 * Up to 10 of today's upcoming appointments — visitor, host, scheduled time,
 * status. Pairs with RecentCheckInsCard in the spec's "live activity" panels.
 */
export function UpcomingAppointmentsCard({
  items,
}: UpcomingAppointmentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming today</CardTitle>
        <CardDescription>Scheduled appointments</CardDescription>
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <EmptyState
            title="No appointments scheduled"
            description="Upcoming appointments for today will appear here."
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.appointmentId}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.visitorName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.hostName ? `with ${item.hostName}` : "Host TBD"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums">
                    {format(fromUnixTime(item.scheduledDatetime), "p")}
                  </p>
                  <Badge
                    variant={apptVariant(item.status)}
                    className="mt-1 capitalize"
                  >
                    {item.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function apptVariant(status: AppointmentStatus): BadgeProps["variant"] {
  switch (status) {
    case "scheduled":
      return "info";
    case "fulfilled":
      return "success";
    case "missed":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}
