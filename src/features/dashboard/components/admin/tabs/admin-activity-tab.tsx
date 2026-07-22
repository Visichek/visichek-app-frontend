import { Eye, UserCheck } from "lucide-react";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { StatGroup } from "@/components/recipes/stat-group";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { TopList } from "@/components/recipes/top-list";
import type { AdminDashboardStats, TopItem } from "@/types/dashboard";

interface AdminActivityTabProps {
  stats: AdminDashboardStats;
}

function tenantsToTopItems<T>(
  items: T[],
  opts: {
    getId: (t: T) => string;
    getLabel: (t: T) => string;
    getValue: (t: T) => number;
    getExtra?: (t: T) => Record<string, unknown>;
  },
): TopItem[] {
  const total = items.reduce((s, t) => s + opts.getValue(t), 0);
  return items.map((t) => ({
    id: opts.getId(t),
    label: opts.getLabel(t),
    value: opts.getValue(t),
    percentage: total > 0 ? (opts.getValue(t) / total) * 100 : 0,
    extra: opts.getExtra?.(t),
  }));
}

export function AdminActivityTab({ stats }: AdminActivityTabProps) {
  return (
    <div className="space-y-6">
      <StatGroup
        title="Cross-organization visitors"
        items={[
          {
            label: "Visitors today",
            value: stats.visitorsToday,
            icon: <Eye className="h-4 w-4" />,
          },
          {
            label: "Check-ins today",
            value: stats.visitorCheckInsToday,
            icon: <UserCheck className="h-4 w-4" />,
          },
          {
            label: "Check-ins (7d)",
            value: stats.visitorCheckIns7d,
            icon: <UserCheck className="h-4 w-4" />,
          },
          {
            label: "Check-ins (30d)",
            value: stats.visitorCheckIns30d,
            icon: <UserCheck className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="Visitor check-ins"
          description="Last 30 days"
          data={stats.visitCheckInsLast30Days}
          color="hsl(38 92% 50%)"
          valueLabel="Check-ins"
          height={220}
        />
        <TimeSeriesChart
          title="Visitor signups"
          description="Last 30 days"
          data={stats.visitorSignupsLast30Days}
          color="hsl(199 89% 48%)"
          valueLabel="Signups"
          height={220}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HeatmapBars
          title="By hour of day (UTC)"
          description="Cross-organization check-ins, last 30 days"
          data={stats.hourlyDistribution.map((b) => ({
            label: b.label,
            value: b.value,
          }))}
          unit="check-ins"
        />
        <HeatmapBars
          title="By day of week"
          description="Cross-organization check-ins, last 30 days"
          data={stats.dayOfWeekDistribution.map((b) => ({
            label: b.label,
            value: b.value,
          }))}
          unit="check-ins"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopList
          title="Top organizations by visitors"
          description="Lifetime visitor profile count"
          items={tenantsToTopItems(stats.topTenantsByVisitors, {
            getId: (t) => t.tenantId,
            getLabel: (t) => t.companyName,
            getValue: (t) => t.visitorCount,
          })}
          unit="visitors"
        />
        <TopList
          title="Top organizations by activity"
          description="Check-ins in the last 30 days"
          items={tenantsToTopItems(stats.topTenantsByActivity, {
            getId: (t) => t.tenantId,
            getLabel: (t) => t.companyName,
            getValue: (t) => t.checkIns30d,
          })}
          unit="check-ins"
        />
      </section>
    </div>
  );
}
