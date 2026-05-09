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
import { StatCard } from "@/components/recipes/stat-card";
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
  const hasHourlyData = stats.hourlyDistribution.some((b) => b.value > 0);
  const hasDayOfWeekData = stats.dayOfWeekDistribution.some((b) => b.value > 0);
  const hasAppointmentMix = stats.appointmentStatusDistribution.length > 0;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            title="Visitors today"
            value={stats.visitorsToday}
            icon={<UserPlus className="h-4 w-4" />}
            description={`${stats.checkInsToday} check-ins`}
          />
          <StatCard
            title="New"
            value={stats.newVisitorsToday}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <StatCard
            title="Returning"
            value={stats.returningVisitorsToday}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Check-outs"
            value={stats.checkOutsToday}
            icon={<UserMinus className="h-4 w-4" />}
          />
          <StatCard
            title="Peak hour"
            value={formatPeakHour(stats.peakHourToday)}
            icon={<Clock className="h-4 w-4" />}
            description="UTC"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Appointments
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Scheduled"
            value={stats.appointmentsScheduled}
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <StatCard
            title="Fulfilled"
            value={stats.appointmentsFulfilled}
            icon={<CalendarCheck2 className="h-4 w-4" />}
          />
          <StatCard
            title="Missed"
            value={stats.appointmentsMissed}
            icon={<CalendarX2 className="h-4 w-4" />}
          />
          <StatCard
            title="Cancelled"
            value={stats.appointmentsCancelled}
            icon={<CalendarX2 className="h-4 w-4" />}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            <div className="grid grid-cols-1 content-start gap-4">
              <StatCard
                title="Fulfillment rate"
                value={pct(stats.appointmentFulfillmentRate)}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                title="No-show rate"
                value={pct(stats.appointmentNoShowRate)}
                icon={<CalendarX2 className="h-4 w-4" />}
              />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Quality
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            title="Verification"
            value={pct(stats.verificationRate)}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Consent"
            value={pct(stats.consentRate)}
            icon={<BadgeCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Denials"
            value={pct(stats.denialRate)}
            icon={<ShieldOff className="h-4 w-4" />}
            description={`${stats.denialsToday} today`}
          />
          <StatCard
            title="Badge issued"
            value={pct(stats.badgeIssueRate)}
            icon={<BadgeCheck className="h-4 w-4" />}
          />
          <StatCard
            title="KYC pass"
            value={pct(stats.avgKycPassRate)}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Overdue checkouts"
            value={stats.overdueCheckouts}
            icon={<HourglassIcon className="h-4 w-4" />}
            description="> 4h on site"
          />
        </div>
      </section>

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
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Visit duration
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Average"
              value={`${stats.avgVisitDurationMinutes.toFixed(1)} min`}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              title="Longest today"
              value={`${stats.longestVisitTodayMinutes.toFixed(0)} min`}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              title="Shortest today"
              value={`${stats.shortestVisitTodayMinutes.toFixed(0)} min`}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              title="Denials today"
              value={stats.denialsToday}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>
        </section>
      )}
    </div>
  );
}
