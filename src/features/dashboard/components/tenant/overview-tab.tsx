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
import { StatGroup } from "@/components/recipes/stat-group";
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
    <div className="space-y-6">
      <StatGroup
        title="Headline"
        items={[
          {
            label: "Total visitors",
            value: stats.totalVisitors,
            description: "Lifetime",
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: "Total appointments",
            value: stats.totalAppointments,
            description: "Lifetime",
            icon: <CalendarDays className="h-4 w-4" />,
          },
          {
            label: "New this month",
            value: stats.newSignupsThisMonth,
            trend: asTrend(stats.signupsGrowthMom),
            description: "vs last month",
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "Retention rate",
            value: pct(stats.visitorRetentionRate),
            description: `${stats.returningVisitorCount} returning`,
            icon: <Repeat className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <StatGroup
        title="Live now"
        items={[
          {
            label: "Active",
            value: stats.currentlyActive,
            description: "On site",
            icon: <UserCheck className="h-4 w-4" />,
          },
          {
            label: "Awaiting checkout",
            value: stats.awaitingCheckout,
            icon: <UserMinus className="h-4 w-4" />,
            tone: stats.awaitingCheckout > 0 ? "warning" : "default",
          },
          {
            label: "Pending approval",
            value: stats.pendingApproval,
            icon: <ShieldAlert className="h-4 w-4" />,
            tone: stats.pendingApproval > 0 ? "warning" : "default",
          },
          {
            label: "Pending KYC",
            value: stats.pendingKyc,
            icon: <ShieldCheck className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Visits — last 30 days"
            description="Daily check-ins"
            data={stats.visitsLast30Days}
            valueLabel="Visits"
            height={240}
          />
        </div>
        <DistributionPie
          title="New vs returning"
          description={`${stats.totalVisitors} visitor${stats.totalVisitors === 1 ? "" : "s"} all time`}
          data={stats.newVsReturning}
          height={240}
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
