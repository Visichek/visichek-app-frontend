import {
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  ClipboardList,
  CreditCard,
  Eye,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Wallet,
} from "lucide-react";
import { StatGroup } from "@/components/recipes/stat-group";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { AdminTenantBriefTable } from "@/features/dashboard/components/admin/admin-tenant-brief-table";
import {
  formatCurrency,
  formatCurrencyMajor,
} from "@/lib/utils/format-currency";
import type { AdminDashboardStats, GrowthMetric } from "@/types/dashboard";

interface AdminOverviewTabProps {
  stats: AdminDashboardStats;
}

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

function asTrend(metric: GrowthMetric | undefined) {
  if (!metric || metric.changePercent === 0) return undefined;
  return {
    value: metric.changePercent,
    isPositive: metric.changePercent >= 0,
  };
}

/**
 * Top-level "is the platform healthy" view. Surfaces the headline numbers
 * an admin glances at first, plus the two trend charts that explain
 * direction. Deeper breakdowns live in the other tabs.
 */
export function AdminOverviewTab({ stats }: AdminOverviewTabProps) {
  return (
    <div className="space-y-6">
      <StatGroup
        title="Headline"
        items={[
          {
            label: "Tenants",
            value: stats.totalTenants,
            description: `${stats.activeTenants} active`,
            icon: <Building2 className="h-4 w-4" />,
          },
          {
            label: "MRR",
            value: formatCurrencyMajor(stats.mrr),
            description: "Monthly recurring",
            icon: <BadgeDollarSign className="h-4 w-4" />,
            trend: asTrend(stats.revenueGrowthMom),
          },
          {
            label: "Active subs",
            value: stats.activeSubscriptions,
            description: `${stats.trialingSubscriptions} trialing`,
            icon: <CreditCard className="h-4 w-4" />,
          },
          {
            label: "Open incidents",
            value: stats.openIncidents,
            description: `${stats.criticalIncidents} critical`,
            icon: <ShieldAlert className="h-4 w-4" />,
            tone: stats.openIncidents > 0 ? "warning" : "default",
          },
          {
            label: "Open DSRs",
            value: stats.dsrOpen,
            description: "Awaiting response",
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: "Visitors today",
            value: stats.visitorsToday,
            description: `${stats.visitorCheckInsToday} check-ins`,
            icon: <Eye className="h-4 w-4" />,
          },
        ]}
        columns={6}
      />

      <StatGroup
        title="Today &amp; this period"
        items={[
          {
            label: "Revenue today",
            value: formatCurrency(stats.revenueTodayMinor),
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            label: "Revenue (30d)",
            value: formatCurrency(stats.revenue30dMinor),
            trend: asTrend(stats.revenueGrowthMom),
            description: "vs last month",
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            label: "New tenants (30d)",
            value: stats.newTenants30d,
            trend: asTrend(stats.tenantsGrowthMom),
            description: "vs last month",
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "Payment success",
            value: pct(stats.paymentSuccessRate),
            description: `${stats.paymentsFailed30d} failed (30d)`,
            icon: <UserCheck className="h-4 w-4" />,
            tone:
              stats.paymentSuccessRate < 90 && stats.paymentsFailed30d > 0
                ? "warning"
                : "default",
          },
          {
            label: "Dunning queue",
            value: stats.dunningQueueSize,
            description: "Past-due subs",
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats.dunningQueueSize > 0 ? "warning" : "default",
          },
          {
            label: "Avg invoice",
            value: formatCurrency(stats.avgInvoiceValueMinor),
            icon: <CreditCard className="h-4 w-4" />,
          },
        ]}
        columns={6}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="Tenant signups"
          description="Last 30 days"
          data={stats.tenantSignupsLast30Days}
          valueLabel="Signups"
          height={220}
        />
        <TimeSeriesChart
          title="Revenue"
          description="Last 30 days"
          data={stats.revenueLast30DaysMinor}
          color="hsl(262 83% 58%)"
          valueLabel="Revenue"
          valueFormatter={(v) => formatCurrency(v)}
          height={220}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AdminTenantBriefTable
          title="Recent tenant signups"
          description="10 most recently provisioned"
          rows={stats.recentTenantSignups}
          activityHeader="Visitors"
        />
        <AdminTenantBriefTable
          title="Recently active tenants"
          description="Top 10 by check-ins in the last 30 days"
          rows={stats.recentlyActiveTenants}
          activityHeader="Check-ins (30d)"
        />
      </section>
    </div>
  );
}
