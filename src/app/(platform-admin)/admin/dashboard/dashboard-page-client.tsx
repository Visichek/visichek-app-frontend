"use client";

import { format, formatDistanceToNow, fromUnixTime } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CalendarCheck2,
  ClipboardList,
  CreditCard,
  Eye,
  FileSpreadsheet,
  Globe,
  Inbox,
  LifeBuoy,
  Package,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Users,
  Users2,
  Wallet,
} from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { TopList } from "@/components/recipes/top-list";
import { QuickActions } from "@/components/platform-admin/quick-actions";
import { GrowthRow } from "@/features/dashboard/components/growth-row";
import { AdminPlanDistributionTable } from "@/features/dashboard/components/admin/admin-plan-distribution-table";
import { AdminTenantBriefTable } from "@/features/dashboard/components/admin/admin-tenant-brief-table";
import { AdminTopRevenueTable } from "@/features/dashboard/components/admin/admin-top-revenue-table";
import { useAdminDashboardStats } from "@/features/auth/hooks/use-admin-dashboard";
import {
  formatCurrency,
  formatCurrencyMajor,
} from "@/lib/utils/format-currency";
import type { GrowthMetric, TopItem } from "@/types/dashboard";

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

function asTrend(
  metric: GrowthMetric | undefined,
): { value: number; isPositive: boolean } | undefined {
  if (!metric) return undefined;
  const v = metric.changePercent;
  if (v === 0) return undefined;
  return { value: v, isPositive: v >= 0 };
}

/**
 * Map any of the admin top-tenant lists onto the shared TopItem shape so
 * <TopList> can render them. `percentage` is computed as the row's share
 * of the top-N total, mirroring how the tenant dashboard computes it
 * server-side for its own top lists.
 */
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

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="text-sm font-medium text-muted-foreground">
      {children}
    </h2>
  );
}

export function AdminDashboardPageClient() {
  const { data, isLoading, isError, error, refetch } = useAdminDashboardStats();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const stats = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Dashboard"
        description="Cross-tenant view of growth, revenue, and operational health"
      />

      <QuickActions />

      {/* ── Tenants ─────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-tenants" className="space-y-3">
          <SectionHeading id="admin-tenants">Tenants</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Total"
              value={stats.totalTenants}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              title="Active"
              value={stats.activeTenants}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              title="Inactive"
              value={stats.inactiveTenants}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              title="New today"
              value={stats.newTenantsToday}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="New (7d)"
              value={stats.newTenants7d}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="New (30d)"
              value={stats.newTenants30d}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={asTrend(stats.tenantsGrowthMom)}
              description="vs last month"
            />
          </div>
          <GrowthRow
            metrics={[
              {
                label: "Tenant signups — week over week",
                metric: stats.tenantsGrowthWow,
              },
              {
                label: "Tenant signups — month over month",
                metric: stats.tenantsGrowthMom,
              },
              {
                label: "Visitor signups — month over month",
                metric: stats.visitorsGrowthMom,
              },
            ]}
          />
        </section>
      )}

      {/* ── Users ───────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-users" className="space-y-3">
          <SectionHeading id="admin-users">Users</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Tenant users"
              value={stats.totalTenantUsers}
              icon={<Users className="h-4 w-4" />}
              description="All system users across tenants"
            />
            <StatCard
              title="Application users"
              value={stats.totalApplicationUsers}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              title="Application admins"
              value={stats.totalApplicationAdmins}
              icon={<UserCheck className="h-4 w-4" />}
            />
            <StatCard
              title="Visitors (lifetime)"
              value={stats.totalVisitorsAllTime}
              icon={<Eye className="h-4 w-4" />}
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              System user roles
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatCard
                title="Super admins"
                value={stats.systemUserRoleBreakdown.superAdmin}
                icon={<UserCheck className="h-4 w-4" />}
              />
              <StatCard
                title="Dept admins"
                value={stats.systemUserRoleBreakdown.deptAdmin}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                title="Receptionists"
                value={stats.systemUserRoleBreakdown.receptionist}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                title="Auditors"
                value={stats.systemUserRoleBreakdown.auditor}
                icon={<ClipboardList className="h-4 w-4" />}
              />
              <StatCard
                title="Security officers"
                value={stats.systemUserRoleBreakdown.securityOfficer}
                icon={<ShieldAlert className="h-4 w-4" />}
              />
              <StatCard
                title="DPOs"
                value={stats.systemUserRoleBreakdown.dpo}
                icon={<ClipboardList className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Subscriptions ───────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-subs" className="space-y-3">
          <SectionHeading id="admin-subs">Subscriptions</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Total"
              value={stats.totalSubscriptions}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <StatCard
              title="Active"
              value={stats.activeSubscriptions}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <StatCard
              title="Trialing"
              value={stats.trialingSubscriptions}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <StatCard
              title="Past due"
              value={stats.pastDueSubscriptions}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              title="Suspended"
              value={stats.suspendedSubscriptions}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              title="Cancelled (30d)"
              value={stats.cancelled30d}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="New (30d)"
              value={stats.newSubscriptions30d}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={asTrend(stats.subscriptionsGrowthMom)}
              description="vs last month"
            />
            <StatCard
              title="Churn rate (30d)"
              value={pct(stats.churnRate30d)}
              icon={<ArrowDownRight className="h-4 w-4" />}
              description="Cancelled / total"
            />
            <StatCard
              title="Trial conversion"
              value={pct(stats.trialConversionRate)}
              icon={<ArrowUpRight className="h-4 w-4" />}
              description="Trials moving to paid"
            />
          </div>
        </section>
      )}

      {/* ── Revenue ─────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-revenue" className="space-y-3">
          <SectionHeading id="admin-revenue">Revenue</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="MRR"
              value={formatCurrencyMajor(stats.mrr)}
              icon={<BadgeDollarSign className="h-4 w-4" />}
              description="Monthly recurring"
            />
            <StatCard
              title="ARR"
              value={formatCurrencyMajor(stats.arr)}
              icon={<BadgeDollarSign className="h-4 w-4" />}
              description="MRR × 12"
            />
            <StatCard
              title="Monthly subs"
              value={formatCurrencyMajor(stats.totalMonthlyRevenue)}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <StatCard
              title="Yearly subs"
              value={formatCurrencyMajor(stats.totalYearlyRevenue)}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Revenue today"
              value={formatCurrency(stats.revenueTodayMinor)}
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatCard
              title="Revenue (7d)"
              value={formatCurrency(stats.revenue7dMinor)}
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatCard
              title="Revenue (30d)"
              value={formatCurrency(stats.revenue30dMinor)}
              icon={<Wallet className="h-4 w-4" />}
              trend={asTrend(stats.revenueGrowthMom)}
              description="vs last month"
            />
            <StatCard
              title="Avg invoice"
              value={formatCurrency(stats.avgInvoiceValueMinor)}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Invoices (30d)"
              value={stats.invoiceCount30d}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
            <StatCard
              title="Paid (30d)"
              value={stats.paidInvoiceCount30d}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
            <StatCard
              title="Voided (30d)"
              value={stats.failedInvoiceCount30d}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
            <StatCard
              title="Issued"
              value={stats.invoiceStatusBreakdown.issued}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
            <StatCard
              title="Refunded"
              value={stats.invoiceStatusBreakdown.refunded}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
          </div>
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
        </section>
      )}

      {/* ── Dunning / payments ──────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-dunning" className="space-y-3">
          <SectionHeading id="admin-dunning">Payments &amp; dunning</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Succeeded (30d)"
              value={stats.paymentsSucceeded30d}
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatCard
              title="Failed (30d)"
              value={stats.paymentsFailed30d}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              title="Success rate"
              value={pct(stats.paymentSuccessRate)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="Dunning queue"
              value={stats.dunningQueueSize}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Past-due subscriptions"
            />
          </div>
        </section>
      )}

      {/* ── Plans ───────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-plans" className="space-y-3">
          <SectionHeading id="admin-plans">Plans</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Total"
              value={stats.totalPlans}
              icon={<Package className="h-4 w-4" />}
            />
            <StatCard
              title="Active"
              value={stats.activePlans}
              icon={<Package className="h-4 w-4" />}
            />
            <StatCard
              title="Draft"
              value={stats.draftPlans}
              icon={<Package className="h-4 w-4" />}
            />
            <StatCard
              title="Archived"
              value={stats.archivedPlans}
              icon={<Package className="h-4 w-4" />}
            />
          </div>
          <AdminPlanDistributionTable rows={stats.planDistribution} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DistributionPie
              title="Plan tier"
              description="Subscribers per tier"
              data={stats.planTierDistribution}
            />
            <DistributionPie
              title="Billing cycle"
              description="Monthly vs yearly"
              data={stats.billingCycleDistribution}
            />
            <DistributionPie
              title="Payment provider"
              description="Active tenants by provider"
              data={stats.paymentProviderDistribution}
            />
          </div>
        </section>
      )}

      {/* ── Incidents ───────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-incidents" className="space-y-3">
          <SectionHeading id="admin-incidents">Incidents</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Total"
              value={stats.totalIncidents}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <StatCard
              title="Open"
              value={stats.openIncidents}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <StatCard
              title="Critical"
              value={stats.criticalIncidents}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              title="Today"
              value={stats.incidentsToday}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <StatCard
              title="Last 30d"
              value={stats.incidents30d}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DistributionPie
              title="Incident type"
              data={stats.incidentTypeDistribution}
            />
            <DistributionPie
              title="Incident status"
              data={stats.incidentStatusDistribution}
            />
            <TopList
              title="Top tenants by incidents"
              description="Across all severities"
              items={tenantsToTopItems(stats.topTenantsByIncidents, {
                getId: (t) => t.tenantId,
                getLabel: (t) => t.companyName,
                getValue: (t) => t.incidentCount,
              })}
              unit="incidents"
            />
          </div>
        </section>
      )}

      {/* ── Visitors (cross-tenant) ─────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-visitors" className="space-y-3">
          <SectionHeading id="admin-visitors">
            Visitors (cross-tenant)
          </SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Visitors today"
              value={stats.visitorsToday}
              icon={<Eye className="h-4 w-4" />}
            />
            <StatCard
              title="Check-ins today"
              value={stats.visitorCheckInsToday}
              icon={<UserCheck className="h-4 w-4" />}
            />
            <StatCard
              title="Check-ins (7d)"
              value={stats.visitorCheckIns7d}
              icon={<UserCheck className="h-4 w-4" />}
            />
            <StatCard
              title="Check-ins (30d)"
              value={stats.visitorCheckIns30d}
              icon={<UserCheck className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopList
              title="Top tenants by visitors"
              description="Lifetime visitor profile count"
              items={tenantsToTopItems(stats.topTenantsByVisitors, {
                getId: (t) => t.tenantId,
                getLabel: (t) => t.companyName,
                getValue: (t) => t.visitorCount,
              })}
              unit="visitors"
            />
            <TopList
              title="Top tenants by activity"
              description="Check-ins in the last 30 days"
              items={tenantsToTopItems(stats.topTenantsByActivity, {
                getId: (t) => t.tenantId,
                getLabel: (t) => t.companyName,
                getValue: (t) => t.checkIns30d,
              })}
              unit="check-ins"
            />
          </div>
        </section>
      )}

      {/* ── Geography ───────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-geo" className="space-y-3">
          <SectionHeading id="admin-geo">Geography</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DistributionPie
              title="Tenants by country"
              description="Active tenants by hosting country"
              data={stats.tenantsByCountry}
            />
            <div className="grid grid-cols-1 content-start gap-4">
              <StatCard
                title="Countries represented"
                value={stats.tenantsByCountry.length}
                icon={<Globe className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Onboarding ──────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-onboarding" className="space-y-3">
          <SectionHeading id="admin-onboarding">Onboarding pipeline</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Total"
              value={stats.onboardingTotal}
              icon={<Inbox className="h-4 w-4" />}
            />
            <StatCard
              title="New"
              value={stats.onboardingNew}
              icon={<Inbox className="h-4 w-4" />}
            />
            <StatCard
              title="Accepted (30d)"
              value={stats.onboardingAccepted30d}
              icon={<CalendarCheck2 className="h-4 w-4" />}
            />
            <StatCard
              title="Rejected (30d)"
              value={stats.onboardingRejected30d}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              title="Completed (30d)"
              value={stats.onboardingCompleted30d}
              icon={<CalendarCheck2 className="h-4 w-4" />}
            />
            <StatCard
              title="Acceptance rate"
              value={pct(stats.onboardingAcceptanceRate)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>
          <DistributionPie
            title="Onboarding status"
            description="Across all submissions"
            data={stats.onboardingStatusDistribution}
            height={220}
          />
        </section>
      )}

      {/* ── Support ─────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-support" className="space-y-3">
          <SectionHeading id="admin-support">Support cases</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Total"
              value={stats.supportCasesTotal}
              icon={<LifeBuoy className="h-4 w-4" />}
            />
            <StatCard
              title="Open"
              value={stats.supportCasesOpen}
              icon={<LifeBuoy className="h-4 w-4" />}
            />
            <StatCard
              title="Last 30d"
              value={stats.supportCases30d}
              icon={<LifeBuoy className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DistributionPie
              title="Status"
              data={stats.supportStatusDistribution}
            />
            <DistributionPie
              title="Priority"
              data={stats.supportPriorityDistribution}
            />
            <DistributionPie
              title="Category"
              data={stats.supportCategoryDistribution}
            />
          </div>
          <TopList
            title="Top tenants by support load"
            description="Open and total cases"
            items={tenantsToTopItems(stats.topTenantsBySupport, {
              getId: (t) => t.tenantId,
              getLabel: (t) => t.companyName,
              getValue: (t) => t.totalCases,
              getExtra: (t) => ({ openCases: t.openCases }),
            })}
            unit="cases"
          />
        </section>
      )}

      {/* ── Compliance / DSR ────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-compliance" className="space-y-3">
          <SectionHeading id="admin-compliance">Compliance</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Open DSRs"
              value={stats.dsrOpen}
              icon={<ClipboardList className="h-4 w-4" />}
            />
            <StatCard
              title="Total DSRs"
              value={stats.dsrTotal}
              icon={<ClipboardList className="h-4 w-4" />}
            />
            <StatCard
              title="DSRs (30d)"
              value={stats.dsr30d}
              icon={<ClipboardList className="h-4 w-4" />}
            />
            <StatCard
              title="Deadline incidents"
              value={stats.incidentsApproachingDeadline}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Within 24h of NDPC deadline"
            />
          </div>
          <DistributionPie
            title="DSR status"
            data={stats.dsrStatusDistribution}
            height={220}
          />
        </section>
      )}

      {/* ── Activity over time ──────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-activity" className="space-y-3">
          <SectionHeading id="admin-activity">Activity (last 30 days)</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Tenant signups"
              data={stats.tenantSignupsLast30Days}
              valueLabel="Signups"
            />
            <TimeSeriesChart
              title="Subscription signups"
              data={stats.subscriptionSignupsLast30Days}
              color="hsl(142 71% 45%)"
              valueLabel="Subscriptions"
            />
            <TimeSeriesChart
              title="Visitor check-ins"
              data={stats.visitCheckInsLast30Days}
              color="hsl(38 92% 50%)"
              valueLabel="Check-ins"
            />
            <TimeSeriesChart
              title="Revenue"
              data={stats.revenueLast30DaysMinor}
              color="hsl(262 83% 58%)"
              valueLabel="Revenue"
              valueFormatter={(v) => formatCurrency(v)}
            />
            <TimeSeriesChart
              title="Visitor signups"
              data={stats.visitorSignupsLast30Days}
              color="hsl(199 89% 48%)"
              valueLabel="Signups"
            />
            <TimeSeriesChart
              title="Incidents"
              data={stats.incidentsLast30Days}
              color="hsl(0 84% 60%)"
              valueLabel="Incidents"
            />
          </div>
        </section>
      )}

      {/* ── Patterns ────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-patterns" className="space-y-3">
          <SectionHeading id="admin-patterns">Patterns</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HeatmapBars
              title="By hour of day (UTC)"
              description="Cross-tenant check-ins, last 30 days"
              data={stats.hourlyDistribution.map((b) => ({
                label: b.label,
                value: b.value,
              }))}
              unit="check-ins"
            />
            <HeatmapBars
              title="By day of week"
              description="Cross-tenant check-ins, last 30 days"
              data={stats.dayOfWeekDistribution.map((b) => ({
                label: b.label,
                value: b.value,
              }))}
              unit="check-ins"
            />
          </div>
        </section>
      )}

      {/* ── Top tenants by revenue ──────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-top-revenue" className="space-y-3">
          <SectionHeading id="admin-top-revenue">Top tenants by revenue</SectionHeading>
          <AdminTopRevenueTable rows={stats.topTenantsByRevenue} />
        </section>
      )}

      {/* ── Recent activity ─────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="admin-recent" className="space-y-3">
          <SectionHeading id="admin-recent">Recent activity</SectionHeading>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          </div>
        </section>
      )}

      {/* ── Footer: last updated ────────────────────────────────── */}
      {stats?.lastUpdated && (
        <p className="pt-2 text-xs text-muted-foreground">
          <Activity className="mr-1 inline h-3 w-3" aria-hidden="true" /> Last
          updated{" "}
          <time dateTime={fromUnixTime(stats.lastUpdated).toISOString()}>
            {formatDistanceToNow(fromUnixTime(stats.lastUpdated), {
              addSuffix: true,
            })}
          </time>
          {" · "}
          <span className="tabular-nums">
            {format(fromUnixTime(stats.lastUpdated), "PP p")}
          </span>
          {" · cached up to 120s server-side"}
        </p>
      )}
    </div>
  );
}
