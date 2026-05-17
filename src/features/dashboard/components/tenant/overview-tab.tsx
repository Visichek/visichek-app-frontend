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
import { LockedOverlay } from "@/features/limitations/components/locked-overlay";
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
 * `null` on a stats field is the Free-plan signature — the backend strips
 * everything that isn't part of the slim Free payload. Use it to decide
 * whether to lock the cell or chart that displays it.
 */
function isLocked(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Default landing tab. Surfaces lifetime totals (which a young tenant
 * actually has data for) up top, with live state and acquisition trend
 * below. Today-only counters live in the Operations tab.
 */
export function OverviewTab({ stats }: OverviewTabProps) {
  // Free-plan responses null these fields by design. Each gate maps to a
  // feature key the upgrade modal can theme around.
  const appointmentsLocked = isLocked(stats.totalAppointments);
  const signupsLocked = isLocked(stats.newSignupsThisMonth);
  const retentionLocked = isLocked(stats.visitorRetentionRate);
  const kycLocked = isLocked(stats.pendingKyc);
  const visitsTrendLocked = isLocked(stats.visitsLast30Days);
  const newVsReturningLocked = isLocked(stats.newVsReturning);
  const recentLocked = isLocked(stats.recentCheckIns);
  const upcomingLocked = isLocked(stats.upcomingAppointmentsToday);

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
            value: stats.totalAppointments ?? 0,
            description: "Lifetime",
            icon: <CalendarDays className="h-4 w-4" />,
            locked: appointmentsLocked,
            lockedFeatureKey: "appointments",
          },
          {
            label: "New this month",
            value: stats.newSignupsThisMonth ?? 0,
            trend: asTrend(stats.signupsGrowthMom),
            description: "vs last month",
            icon: <TrendingUp className="h-4 w-4" />,
            locked: signupsLocked,
            lockedFeatureKey: "csv_export",
          },
          {
            label: "Retention rate",
            value: pct(stats.visitorRetentionRate),
            description: `${stats.returningVisitorCount ?? 0} returning`,
            icon: <Repeat className="h-4 w-4" />,
            locked: retentionLocked,
            lockedFeatureKey: "csv_export",
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
            value: stats.pendingKyc ?? 0,
            icon: <ShieldCheck className="h-4 w-4" />,
            locked: kycLocked,
            lockedFeatureKey: "kyc",
          },
        ]}
        columns={4}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LockedOverlay
            locked={visitsTrendLocked}
            featureKey="csv_export"
            title="Visit trend (last 30 days)"
          >
            <TimeSeriesChart
              title="Visits — last 30 days"
              description="Daily check-ins"
              data={stats.visitsLast30Days}
              valueLabel="Visits"
              height={240}
            />
          </LockedOverlay>
        </div>
        <LockedOverlay
          locked={newVsReturningLocked}
          featureKey="csv_export"
          title="New vs returning"
        >
          <DistributionPie
            title="New vs returning"
            description={`${stats.totalVisitors} visitor${stats.totalVisitors === 1 ? "" : "s"} all time`}
            data={stats.newVsReturning}
            height={240}
            emptyTitle="No visitors yet"
          />
        </LockedOverlay>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LockedOverlay
          locked={recentLocked}
          featureKey="csv_export"
          title="Recent check-ins"
        >
          <RecentCheckInsCard items={stats.recentCheckIns} />
        </LockedOverlay>
        <LockedOverlay
          locked={upcomingLocked}
          featureKey="appointments"
          title="Upcoming appointments"
        >
          <UpcomingAppointmentsCard items={stats.upcomingAppointmentsToday} />
        </LockedOverlay>
      </section>
    </div>
  );
}
