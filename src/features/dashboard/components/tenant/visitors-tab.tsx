import { Crown, Repeat, TrendingUp, UserPlus, Users } from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { StatCard } from "@/components/recipes/stat-card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { TopList } from "@/components/recipes/top-list";
import { GrowthRow } from "@/features/dashboard/components/growth-row";
import type { DistributionSlice, TenantDashboardStats, TopItem } from "@/types/dashboard";

interface VisitorsTabProps {
  stats: TenantDashboardStats;
}

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

/**
 * Filter helper — distributions / top-lists with no data are hidden so the
 * tab doesn't render four "No data yet" cards in a row on a young tenant.
 */
function nonEmpty<T extends { data?: DistributionSlice[]; items?: TopItem[] }>(
  list: T[],
): T[] {
  return list.filter((item) => {
    if ("data" in item && item.data) return item.data.length > 0;
    if ("items" in item && item.items) return item.items.length > 0;
    return false;
  });
}

export function VisitorsTab({ stats }: VisitorsTabProps) {
  const distributions = nonEmpty([
    {
      key: "visit-status",
      title: "Visit status",
      description: "Pipeline mix",
      data: stats.visitStatusDistribution,
    },
    {
      key: "checkin-method",
      title: "Check-in method",
      description: "QR vs ID scan vs manual",
      data: stats.checkInMethodDistribution,
    },
    {
      key: "verification-status",
      title: "Verification",
      data: stats.verificationStatusDistribution,
    },
    {
      key: "consent",
      title: "Consent",
      data: stats.consentDistribution,
    },
  ]);

  const topLists = nonEmpty([
    {
      key: "departments",
      title: "Top departments",
      description: "Most visited",
      items: stats.topDepartments,
      unit: "visits",
    },
    {
      key: "hosts",
      title: "Top hosts",
      description: "Most visitors hosted",
      items: stats.topHosts,
      unit: "visits",
    },
    {
      key: "companies",
      title: "Top companies",
      description: "Most frequent visitors",
      items: stats.topCompanies,
      unit: "visits",
    },
    {
      key: "purposes",
      title: "Top purposes",
      description: "Common reasons for visiting",
      items: stats.topPurposes,
      unit: "visits",
    },
  ]);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Total"
          value={stats.totalVisitors}
          icon={<Users className="h-4 w-4" />}
          description="Lifetime visitor profiles"
        />
        <StatCard
          title="Returning"
          value={stats.returningVisitorCount}
          icon={<Repeat className="h-4 w-4" />}
          description="2 or more visits"
        />
        <StatCard
          title="VIPs"
          value={stats.vipVisitorCount}
          icon={<Crown className="h-4 w-4" />}
          description="5 or more visits"
        />
        <StatCard
          title="Retention rate"
          value={pct(stats.visitorRetentionRate)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          New signups
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Today"
            value={stats.newSignupsToday}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <StatCard
            title="Last 7 days"
            value={stats.newSignups7d}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <StatCard
            title="Last 30 days"
            value={stats.newSignups30d}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <StatCard
            title="This month"
            value={stats.newSignupsThisMonth}
            icon={<UserPlus className="h-4 w-4" />}
            description={`vs ${stats.newSignupsLastMonth} last`}
          />
        </div>
      </section>

      <GrowthRow
        metrics={[
          {
            label: "Signups — week over week",
            metric: stats.signupsGrowthWow,
          },
          {
            label: "Signups — month over month",
            metric: stats.signupsGrowthMom,
          },
          {
            label: "Visits — month over month",
            metric: stats.visitsGrowthMom,
          },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="New visitor signups"
            description="Last 30 days"
            data={stats.signupsLast30Days}
            color="hsl(142 71% 45%)"
            valueLabel="Signups"
            height={240}
          />
        </div>
        <DistributionPie
          title="New vs returning"
          data={stats.newVsReturning}
          height={240}
          emptyTitle="No visitors yet"
        />
      </section>

      {distributions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Distributions
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {distributions.map((d) => (
              <DistributionPie
                key={d.key}
                title={d.title}
                description={d.description}
                data={d.data}
              />
            ))}
          </div>
        </section>
      )}

      {topLists.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Top performers
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {topLists.map((l) => (
              <TopList
                key={l.key}
                title={l.title}
                description={l.description}
                items={l.items}
                unit={l.unit}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
