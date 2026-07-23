import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CreditCard,
  FileSpreadsheet,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { StatGroup } from "@/components/recipes/stat-group";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { GrowthRow } from "@/features/dashboard/components/growth-row";
import { AdminPlanDistributionTable } from "@/features/dashboard/components/admin/admin-plan-distribution-table";
import { AdminTopRevenueTable } from "@/features/dashboard/components/admin/admin-top-revenue-table";
import {
  formatCurrency,
  formatCurrencyMajor,
} from "@/lib/utils/format-currency";
import type { AdminDashboardStats, GrowthMetric } from "@/types/dashboard";

interface AdminBillingTabProps {
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

export function AdminBillingTab({ stats }: AdminBillingTabProps) {
  return (
    <div className="space-y-6">
      <StatGroup
        title="Recurring revenue"
        items={[
          {
            label: "MRR",
            value: formatCurrencyMajor(stats.mrr),
            description: "Monthly recurring",
            icon: <BadgeDollarSign className="h-4 w-4" />,
            trend: asTrend(stats.revenueGrowthMom),
          },
          {
            label: "ARR",
            value: formatCurrencyMajor(stats.arr),
            description: "MRR × 12",
            icon: <BadgeDollarSign className="h-4 w-4" />,
          },
          {
            label: "Monthly subs",
            value: formatCurrencyMajor(stats.totalMonthlyRevenue),
            icon: <CreditCard className="h-4 w-4" />,
          },
          {
            label: "Yearly subs",
            value: formatCurrencyMajor(stats.totalYearlyRevenue),
            icon: <CreditCard className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <StatGroup
        title="Cash collection"
        items={[
          {
            label: "Today",
            value: formatCurrency(stats.revenueTodayMinor),
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            label: "Last 7d",
            value: formatCurrency(stats.revenue7dMinor),
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            label: "Last 30d",
            value: formatCurrency(stats.revenue30dMinor),
            icon: <Wallet className="h-4 w-4" />,
            trend: asTrend(stats.revenueGrowthMom),
            description: "vs last month",
          },
          {
            label: "Avg invoice",
            value: formatCurrency(stats.avgInvoiceValueMinor),
            icon: <FileSpreadsheet className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <GrowthRow
        metrics={[
          {
            label: "Revenue — week over week",
            metric: stats.revenueGrowthWow,
          },
          {
            label: "Revenue — month over month",
            metric: stats.revenueGrowthMom,
          },
          {
            label: "Subscriptions — month over month",
            metric: stats.subscriptionsGrowthMom,
          },
        ]}
      />

      <StatGroup
        title="Subscriptions"
        items={[
          {
            label: "Total",
            value: stats.totalSubscriptions,
            icon: <CreditCard className="h-4 w-4" />,
          },
          {
            label: "Active",
            value: stats.activeSubscriptions,
            icon: <CreditCard className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Trialing",
            value: stats.trialingSubscriptions,
            icon: <CreditCard className="h-4 w-4" />,
          },
          {
            label: "Past due",
            value: stats.pastDueSubscriptions,
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats.pastDueSubscriptions > 0 ? "warning" : "default",
          },
          {
            label: "Suspended",
            value: stats.suspendedSubscriptions,
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats.suspendedSubscriptions > 0 ? "warning" : "default",
          },
          {
            label: "Cancelled (30d)",
            value: stats.cancelled30d,
            icon: <AlertTriangle className="h-4 w-4" />,
          },
        ]}
        columns={6}
      />

      <StatGroup
        items={[
          {
            label: "New (30d)",
            value: stats.newSubscriptions30d,
            trend: asTrend(stats.subscriptionsGrowthMom),
            description: "vs last month",
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "Churn rate (30d)",
            value: pct(stats.churnRate30d),
            description: "Cancelled / total",
            icon: <ArrowDownRight className="h-4 w-4" />,
            tone: stats.churnRate30d > 5 ? "warning" : "default",
          },
          {
            label: "Trial conversion",
            value: pct(stats.trialConversionRate),
            description: "Trials moving to paid",
            icon: <ArrowUpRight className="h-4 w-4" />,
          },
        ]}
        columns={3}
      />

      <StatGroup
        title="Payments &amp; dunning"
        items={[
          {
            label: "Succeeded (30d)",
            value: stats.paymentsSucceeded30d,
            icon: <Wallet className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Failed (30d)",
            value: stats.paymentsFailed30d,
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats.paymentsFailed30d > 0 ? "warning" : "default",
          },
          {
            label: "Success rate",
            value: pct(stats.paymentSuccessRate),
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "Dunning queue",
            value: stats.dunningQueueSize,
            description: "Past-due subscriptions",
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats.dunningQueueSize > 0 ? "warning" : "default",
          },
        ]}
        columns={4}
      />

      <StatGroup
        title="Invoices (last 30 days)"
        items={[
          {
            label: "Issued total",
            value: stats.invoiceCount30d,
            icon: <FileSpreadsheet className="h-4 w-4" />,
          },
          {
            label: "Paid",
            value: stats.paidInvoiceCount30d,
            icon: <FileSpreadsheet className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Voided",
            value: stats.failedInvoiceCount30d,
            icon: <FileSpreadsheet className="h-4 w-4" />,
          },
          {
            label: "Open",
            value: stats.invoiceStatusBreakdown.issued,
            icon: <FileSpreadsheet className="h-4 w-4" />,
          },
          {
            label: "Refunded",
            value: stats.invoiceStatusBreakdown.refunded,
            icon: <FileSpreadsheet className="h-4 w-4" />,
          },
        ]}
        columns={5}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="Subscription signups"
          description="Last 30 days"
          data={stats.subscriptionSignupsLast30Days}
          color="hsl(142 71% 45%)"
          valueLabel="Subscriptions"
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

      <StatGroup
        title="Plans"
        items={[
          {
            label: "Total",
            value: stats.totalPlans,
            icon: <Package className="h-4 w-4" />,
          },
          {
            label: "Active",
            value: stats.activePlans,
            icon: <Package className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Draft",
            value: stats.draftPlans,
            icon: <Package className="h-4 w-4" />,
          },
          {
            label: "Archived",
            value: stats.archivedPlans,
            icon: <Package className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <AdminPlanDistributionTable rows={stats.planDistribution} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DistributionPie
          title="Plan tier"
          description="Subscribers per tier"
          data={stats.planTierDistribution}
          height={220}
        />
        <DistributionPie
          title="Billing cycle"
          description="Monthly vs yearly"
          data={stats.billingCycleDistribution}
          height={220}
        />
        <DistributionPie
          title="Payment provider"
          description="Active organizations"
          data={stats.paymentProviderDistribution}
          height={220}
        />
      </section>

      <AdminTopRevenueTable rows={stats.topTenantsByRevenue} />
    </div>
  );
}
