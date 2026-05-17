import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  Clock,
  HourglassIcon,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { StatGroup } from "@/components/recipes/stat-group";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import type { TenantDashboardStats } from "@/types/dashboard";

interface OperationsTabProps {
  stats: TenantDashboardStats;
}

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

function formatPeakHour(hour: number | null | undefined): string {
  if (hour === null || hour === undefined) return "—";
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function OperationsTab({ stats }: OperationsTabProps) {
  // Free-plan responses null these fields out — treat null/undefined as
  // "no data" rather than crashing on .some / .length.
  const hasHourlyData =
    stats.hourlyDistribution?.some((b) => b.value > 0) ?? false;
  const hasDayOfWeekData =
    stats.dayOfWeekDistribution?.some((b) => b.value > 0) ?? false;
  const hasAppointmentMix =
    (stats.appointmentStatusDistribution?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <StatGroup
        title="Today"
        items={[
          {
            label: "Visitors",
            value: stats.visitorsToday,
            description: `${stats.checkInsToday} check-ins`,
            icon: <UserPlus className="h-4 w-4" />,
          },
          {
            label: "New",
            value: stats.newVisitorsToday,
            icon: <UserPlus className="h-4 w-4" />,
          },
          {
            label: "Returning",
            value: stats.returningVisitorsToday,
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "Check-outs",
            value: stats.checkOutsToday,
            icon: <UserMinus className="h-4 w-4" />,
          },
          {
            label: "Peak hour",
            value: formatPeakHour(stats.peakHourToday),
            description: "UTC",
            icon: <Clock className="h-4 w-4" />,
          },
        ]}
        columns={5}
      />

      <StatGroup
        title="Appointments"
        items={[
          {
            label: "Scheduled",
            value: stats.appointmentsScheduled,
            icon: <CalendarDays className="h-4 w-4" />,
          },
          {
            label: "Fulfilled",
            value: stats.appointmentsFulfilled,
            icon: <CalendarCheck2 className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Missed",
            value: stats.appointmentsMissed,
            icon: <CalendarX2 className="h-4 w-4" />,
            tone: stats.appointmentsMissed > 0 ? "warning" : "default",
          },
          {
            label: "Cancelled",
            value: stats.appointmentsCancelled,
            icon: <CalendarX2 className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Appointments — last 30 days"
            data={stats.appointmentsLast30Days}
            color="hsl(173 80% 40%)"
            valueLabel="Appointments"
            height={220}
          />
        </div>
        {hasAppointmentMix ? (
          <DistributionPie
            title="Status mix"
            data={stats.appointmentStatusDistribution}
            height={220}
          />
        ) : (
          <StatGroup
            items={[
              {
                label: "Fulfillment rate",
                value: pct(stats.appointmentFulfillmentRate),
                icon: <TrendingUp className="h-4 w-4" />,
              },
              {
                label: "No-show rate",
                value: pct(stats.appointmentNoShowRate),
                icon: <CalendarX2 className="h-4 w-4" />,
              },
            ]}
            columns={2}
          />
        )}
      </section>

      <StatGroup
        title="Quality"
        items={[
          {
            label: "Verification",
            value: pct(stats.verificationRate),
            icon: <ShieldCheck className="h-4 w-4" />,
          },
          {
            label: "Consent",
            value: pct(stats.consentRate),
            icon: <BadgeCheck className="h-4 w-4" />,
          },
          {
            label: "Denials",
            value: pct(stats.denialRate),
            description: `${stats.denialsToday} today`,
            icon: <ShieldOff className="h-4 w-4" />,
          },
          {
            label: "Badge issued",
            value: pct(stats.badgeIssueRate),
            icon: <BadgeCheck className="h-4 w-4" />,
          },
          {
            label: "KYC pass",
            value: pct(stats.avgKycPassRate),
            icon: <ShieldCheck className="h-4 w-4" />,
          },
          {
            label: "Overdue checkouts",
            value: stats.overdueCheckouts,
            description: "> 4h on site",
            icon: <HourglassIcon className="h-4 w-4" />,
            tone: stats.overdueCheckouts > 0 ? "warning" : "default",
          },
        ]}
        columns={6}
      />

      {(hasHourlyData || hasDayOfWeekData) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Patterns (last 30 days)
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {hasHourlyData && (
              <HeatmapBars
                title="By hour of day (UTC)"
                data={stats.hourlyDistribution.map((b) => ({
                  label: b.label,
                  value: b.value,
                }))}
                unit="visits"
              />
            )}
            {hasDayOfWeekData && (
              <HeatmapBars
                title="By day of week"
                data={stats.dayOfWeekDistribution.map((b) => ({
                  label: b.label,
                  value: b.value,
                }))}
                unit="visits"
              />
            )}
          </div>
        </section>
      )}

      {stats.avgVisitDurationMinutes > 0 && (
        <StatGroup
          title="Visit duration"
          items={[
            {
              label: "Average",
              value: `${stats.avgVisitDurationMinutes.toFixed(1)} min`,
              icon: <Clock className="h-4 w-4" />,
            },
            {
              label: "Longest today",
              value: `${stats.longestVisitTodayMinutes.toFixed(0)} min`,
              icon: <Clock className="h-4 w-4" />,
            },
            {
              label: "Shortest today",
              value: `${stats.shortestVisitTodayMinutes.toFixed(0)} min`,
              icon: <Clock className="h-4 w-4" />,
            },
            {
              label: "Denials today",
              value: stats.denialsToday,
              icon: <AlertTriangle className="h-4 w-4" />,
              tone: stats.denialsToday > 0 ? "warning" : "default",
            },
          ]}
          columns={4}
        />
      )}
    </div>
  );
}
