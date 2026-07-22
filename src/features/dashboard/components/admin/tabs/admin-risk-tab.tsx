import {
  AlertTriangle,
  CalendarCheck2,
  ClipboardList,
  Inbox,
  LifeBuoy,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { StatGroup } from "@/components/recipes/stat-group";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { TopList } from "@/components/recipes/top-list";
import type { AdminDashboardStats, TopItem } from "@/types/dashboard";

interface AdminRiskTabProps {
  stats: AdminDashboardStats;
}

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
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

export function AdminRiskTab({ stats }: AdminRiskTabProps) {
  const hasIncidentTrend = stats.incidentsLast30Days.some((p) => p.value > 0);

  return (
    <div className="space-y-6">
      <StatGroup
        title="Incidents"
        items={[
          {
            label: "Total",
            value: stats.totalIncidents,
            icon: <ShieldAlert className="h-4 w-4" />,
          },
          {
            label: "Open",
            value: stats.openIncidents,
            icon: <ShieldAlert className="h-4 w-4" />,
            tone: stats.openIncidents > 0 ? "warning" : "default",
          },
          {
            label: "Critical",
            value: stats.criticalIncidents,
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats.criticalIncidents > 0 ? "danger" : "default",
          },
          {
            label: "Today",
            value: stats.incidentsToday,
            icon: <ShieldAlert className="h-4 w-4" />,
          },
          {
            label: "Last 30d",
            value: stats.incidents30d,
            icon: <ShieldAlert className="h-4 w-4" />,
          },
        ]}
        columns={5}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {hasIncidentTrend && (
          <div className="lg:col-span-2">
            <TimeSeriesChart
              title="Incidents — last 30 days"
              data={stats.incidentsLast30Days}
              color="hsl(0 84% 60%)"
              valueLabel="Incidents"
              height={220}
            />
          </div>
        )}
        <DistributionPie
          title="Incident type"
          data={stats.incidentTypeDistribution}
          height={220}
        />
        <DistributionPie
          title="Incident status"
          data={stats.incidentStatusDistribution}
          height={220}
        />
        <TopList
          title="Top organizations by incidents"
          description="Across all severities"
          items={tenantsToTopItems(stats.topTenantsByIncidents, {
            getId: (t) => t.tenantId,
            getLabel: (t) => t.companyName,
            getValue: (t) => t.incidentCount,
          })}
          unit="incidents"
        />
      </section>

      <StatGroup
        title="Compliance / DSR"
        items={[
          {
            label: "Open DSRs",
            value: stats.dsrOpen,
            icon: <ClipboardList className="h-4 w-4" />,
            tone: stats.dsrOpen > 0 ? "warning" : "default",
          },
          {
            label: "Total DSRs",
            value: stats.dsrTotal,
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: "DSRs (30d)",
            value: stats.dsr30d,
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: "Deadline incidents",
            value: stats.incidentsApproachingDeadline,
            description: "Within 24h of NDPC",
            icon: <AlertTriangle className="h-4 w-4" />,
            tone:
              stats.incidentsApproachingDeadline > 0 ? "danger" : "default",
          },
        ]}
        columns={4}
      />

      <DistributionPie
        title="DSR status"
        data={stats.dsrStatusDistribution}
        height={220}
      />

      <StatGroup
        title="Onboarding pipeline"
        items={[
          {
            label: "Total",
            value: stats.onboardingTotal,
            icon: <Inbox className="h-4 w-4" />,
          },
          {
            label: "New",
            value: stats.onboardingNew,
            icon: <Inbox className="h-4 w-4" />,
          },
          {
            label: "Accepted (30d)",
            value: stats.onboardingAccepted30d,
            icon: <CalendarCheck2 className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Rejected (30d)",
            value: stats.onboardingRejected30d,
            icon: <AlertTriangle className="h-4 w-4" />,
          },
          {
            label: "Completed (30d)",
            value: stats.onboardingCompleted30d,
            icon: <CalendarCheck2 className="h-4 w-4" />,
          },
          {
            label: "Acceptance rate",
            value: pct(stats.onboardingAcceptanceRate),
            icon: <TrendingUp className="h-4 w-4" />,
          },
        ]}
        columns={6}
      />

      <DistributionPie
        title="Onboarding status"
        description="Across all submissions"
        data={stats.onboardingStatusDistribution}
        height={220}
      />

      <StatGroup
        title="Support cases"
        items={[
          {
            label: "Total",
            value: stats.supportCasesTotal,
            icon: <LifeBuoy className="h-4 w-4" />,
          },
          {
            label: "Open",
            value: stats.supportCasesOpen,
            icon: <LifeBuoy className="h-4 w-4" />,
            tone: stats.supportCasesOpen > 0 ? "warning" : "default",
          },
          {
            label: "Last 30d",
            value: stats.supportCases30d,
            icon: <LifeBuoy className="h-4 w-4" />,
          },
        ]}
        columns={3}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DistributionPie
          title="Status"
          data={stats.supportStatusDistribution}
          height={200}
        />
        <DistributionPie
          title="Priority"
          data={stats.supportPriorityDistribution}
          height={200}
        />
        <DistributionPie
          title="Category"
          data={stats.supportCategoryDistribution}
          height={200}
        />
      </section>

      <TopList
        title="Top organizations by support load"
        description="Open and total cases"
        items={tenantsToTopItems(stats.topTenantsBySupport, {
          getId: (t) => t.tenantId,
          getLabel: (t) => t.companyName,
          getValue: (t) => t.totalCases,
          getExtra: (t) => ({ openCases: t.openCases }),
        })}
        unit="cases"
      />
    </div>
  );
}
