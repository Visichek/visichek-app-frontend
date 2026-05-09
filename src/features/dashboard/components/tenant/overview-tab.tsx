import {
  CalendarDays,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { StatCard } from "@/components/recipes/stat-card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { RecentCheckInsCard } from "@/features/dashboard/components/recent-checkins-card";
import { UpcomingAppointmentsCard } from "@/features/dashboard/components/upcoming-appointments-card";
import type { GrowthMetric, TenantDashboardStats } from "@/types/dashboard";

interface OverviewTabProps {
  stats: TenantDashboardStats;
}

function asTrend(metric: GrowthMetric | undefined) {
  if (!metric || metric.changePercent === 0) return undefined;
  return { value: metric.changePercent, isPositive: metric.changePercent >= 0 };
}

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

/**
 * Default landing tab. Surfaces lifetime totals (which a young tenant
 * actually has data for) up top, with live state and acquisition trend
 * below. Today-only counters live in the Operations tab.
 */
export function OverviewTab({ stats }: OverviewTabProps) {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Total visitors"
          value={stats.totalVisitors}
          icon={<Users className="h-4 w-4" />}
          description="Lifetime"
        />
        <StatCard
          title="Total appointments"
          value={stats.totalAppointments}
          icon={<CalendarDays className="h-4 w-4" />}
          description="Lifetime"
        />
        <StatCard
          title="New this month"
          value={stats.newSignupsThisMonth}
          icon={<TrendingUp className="h-4 w-4" />}
          trend={asTrend(stats.signupsGrowthMom)}
          description="vs last month"
        />
        <StatCard
          title="Retention rate"
          value={pct(stats.visitorRetentionRate)}
          icon={<Repeat className="h-4 w-4" />}
          description={`${stats.returningVisitorCount} returning visitors`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Live now</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Active"
            value={stats.currentlyActive}
            icon={<UserCheck className="h-4 w-4" />}
            description="On site"
          />
          <StatCard
            title="Awaiting checkout"
            value={stats.awaitingCheckout}
            icon={<UserMinus className="h-4 w-4" />}
          />
          <StatCard
            title="Pending approval"
            value={stats.pendingApproval}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
          <StatCard
            title="Pending KYC"
            value={stats.pendingKyc}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Visits — last 30 days"
            description="Daily check-ins"
            data={stats.visitsLast30Days}
            valueLabel="Visits"
            height={260}
          />
        </div>
        <DistributionPie
          title="New vs returning"
          description={`${stats.totalVisitors} visitor${stats.totalVisitors === 1 ? "" : "s"} all time`}
          data={stats.newVsReturning}
          height={260}
          emptyTitle="No visitors yet"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentCheckInsCard items={stats.recentCheckIns} />
        <UpcomingAppointmentsCard items={stats.upcomingAppointmentsToday} />
      </section>
    </div>
  );
}
