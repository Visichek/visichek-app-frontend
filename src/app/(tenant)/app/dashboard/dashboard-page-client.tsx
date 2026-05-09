"use client";

import { format, formatDistanceToNow, fromUnixTime } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { TopList } from "@/components/recipes/top-list";
import { QuickActions } from "@/components/tenant/quick-actions";
import { GrowthRow } from "@/features/dashboard/components/growth-row";
import { RecentCheckInsCard } from "@/features/dashboard/components/recent-checkins-card";
import { UpcomingAppointmentsCard } from "@/features/dashboard/components/upcoming-appointments-card";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import type { GrowthMetric, TenantDashboardStats } from "@/types/dashboard";

function formatPeakHour(hour: number | null | undefined): string {
  if (hour === null || hour === undefined) return "—";
  return `${hour.toString().padStart(2, "0")}:00`;
}

function asTrend(
  metric: GrowthMetric | undefined,
): { value: number; isPositive: boolean } | undefined {
  if (!metric) return undefined;
  const v = metric.changePercent;
  if (v === 0) return undefined;
  return { value: v, isPositive: v >= 0 };
}

function pct(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

type RoleView = TenantDashboardStats["roleView"];

function canSeeCompliance(role: RoleView | undefined): boolean {
  return role === "super_admin" || role === "dpo";
}

function canSeeAudit(role: RoleView | undefined): boolean {
  return role === "super_admin" || role === "auditor" || role === "dpo";
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-sm font-medium text-muted-foreground">
      {children}
    </h2>
  );
}

export function DashboardPageClient() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const stats = data;
  const role = stats?.roleView;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Today's visitor activity at a glance"
      />

      <QuickActions />

      {/* ── Today ───────────────────────────────────────────────── */}
      <section aria-labelledby="dashboard-today" className="space-y-3">
        <SectionHeading id="dashboard-today">Today</SectionHeading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Visitors Today"
            value={stats?.visitorsToday ?? 0}
            icon={<Users className="h-4 w-4" />}
            trend={asTrend(stats?.visitsGrowthDod)}
            description="vs yesterday"
          />
          <StatCard
            title="Active Now"
            value={stats?.currentlyActive ?? 0}
            icon={<UserCheck className="h-4 w-4" />}
            description="On site right now"
          />
          <StatCard
            title="Peak Hour"
            value={formatPeakHour(stats?.peakHourToday)}
            icon={<Clock className="h-4 w-4" />}
            description="Busiest hour today (UTC)"
          />
          <StatCard
            title="Expected Today"
            value={stats?.expectedToday ?? 0}
            icon={<CalendarDays className="h-4 w-4" />}
            description="Scheduled appointments"
          />
        </div>
      </section>

      {/* ── Live state ──────────────────────────────────────────── */}
      <section aria-labelledby="dashboard-live" className="space-y-3">
        <SectionHeading id="dashboard-live">Live state</SectionHeading>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Currently Active"
            value={stats?.currentlyActive ?? 0}
            icon={<UserCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Awaiting Checkout"
            value={stats?.awaitingCheckout ?? 0}
            icon={<UserMinus className="h-4 w-4" />}
          />
          <StatCard
            title="Pending Approval"
            value={stats?.pendingApproval ?? 0}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
          <StatCard
            title="Pending KYC"
            value={stats?.pendingKyc ?? 0}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* ── Today's breakdown ───────────────────────────────────── */}
      <section aria-labelledby="dashboard-breakdown" className="space-y-3">
        <SectionHeading id="dashboard-breakdown">
          Today&apos;s breakdown
        </SectionHeading>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="New Visitors"
            value={stats?.newVisitorsToday ?? 0}
            icon={<UserPlus className="h-4 w-4" />}
            description="First-time visitors"
          />
          <StatCard
            title="Returning"
            value={stats?.returningVisitorsToday ?? 0}
            icon={<Repeat className="h-4 w-4" />}
            description="With prior visits"
          />
          <StatCard
            title="Check-outs"
            value={stats?.checkOutsToday ?? 0}
            icon={<UserMinus className="h-4 w-4" />}
          />
          <StatCard
            title="Denials"
            value={stats?.denialsToday ?? 0}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* ── Growth ──────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-growth" className="space-y-3">
          <SectionHeading id="dashboard-growth">Growth</SectionHeading>
          <GrowthRow
            metrics={[
              { label: "Visits — day over day", metric: stats.visitsGrowthDod },
              { label: "Visits — week over week", metric: stats.visitsGrowthWow },
              { label: "Visits — month over month", metric: stats.visitsGrowthMom },
            ]}
          />
        </section>
      )}

      {/* ── Activity over time ──────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-trend" className="space-y-3">
          <SectionHeading id="dashboard-trend">Activity</SectionHeading>
          <TimeSeriesChart
            title="Visits — last 30 days"
            description="Daily check-ins"
            data={stats.visitsLast30Days}
            height={260}
          />
        </section>
      )}

      {/* ── Live activity ───────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-activity" className="space-y-3">
          <SectionHeading id="dashboard-activity">Live activity</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RecentCheckInsCard items={stats.recentCheckIns} />
            <UpcomingAppointmentsCard items={stats.upcomingAppointmentsToday} />
          </div>
        </section>
      )}

      {/* ── Top performers ──────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-top" className="space-y-3">
          <SectionHeading id="dashboard-top">Top performers</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopList
              title="Top departments"
              description="Most visited departments"
              items={stats.topDepartments}
              unit="visits"
            />
            <TopList
              title="Top hosts"
              description="Hosts with the most visitors"
              items={stats.topHosts}
              unit="visits"
            />
            <TopList
              title="Top companies"
              description="Companies that visit most often"
              items={stats.topCompanies}
              unit="visits"
            />
            <TopList
              title="Top purposes"
              description="Most common reasons for visiting"
              items={stats.topPurposes}
              unit="visits"
            />
          </div>
        </section>
      )}

      {/* ── Distributions ───────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-distributions" className="space-y-3">
          <SectionHeading id="dashboard-distributions">
            Distributions
          </SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DistributionPie
              title="Visit status"
              description="Pipeline mix across all visits"
              data={stats.visitStatusDistribution}
            />
            <DistributionPie
              title="Check-in method"
              description="Channel mix (QR vs ID scan vs manual)"
              data={stats.checkInMethodDistribution}
            />
            <DistributionPie
              title="Verification status"
              description="Verified, unverified, denied"
              data={stats.verificationStatusDistribution}
            />
            <DistributionPie
              title="Consent"
              description="Granted, withheld, not captured"
              data={stats.consentDistribution}
            />
          </div>
        </section>
      )}

      {/* ── Patterns ────────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-patterns" className="space-y-3">
          <SectionHeading id="dashboard-patterns">Patterns</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HeatmapBars
              title="By hour of day (UTC)"
              description="Last 30 days"
              data={stats.hourlyDistribution.map((b) => ({
                label: b.label,
                value: b.value,
              }))}
              unit="visits"
            />
            <HeatmapBars
              title="By day of week"
              description="Last 30 days"
              data={stats.dayOfWeekDistribution.map((b) => ({
                label: b.label,
                value: b.value,
              }))}
              unit="visits"
            />
          </div>
        </section>
      )}

      {/* ── Appointments ────────────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-appointments" className="space-y-3">
          <SectionHeading id="dashboard-appointments">Appointments</SectionHeading>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Fulfillment rate"
              value={pct(stats.appointmentFulfillmentRate)}
              icon={<TrendingUp className="h-4 w-4" />}
              description="Fulfilled / total"
            />
            <StatCard
              title="No-show rate"
              value={pct(stats.appointmentNoShowRate)}
              icon={<CalendarX2 className="h-4 w-4" />}
              description="(Missed + cancelled) / total"
            />
            <StatCard
              title="Conversion rate"
              value={pct(stats.appointmentConversionRate)}
              icon={<TrendingUp className="h-4 w-4" />}
              description="Visits via appointment"
            />
          </div>
        </section>
      )}

      {/* ── Operational quality ─────────────────────────────────── */}
      {stats && (
        <section aria-labelledby="dashboard-quality" className="space-y-3">
          <SectionHeading id="dashboard-quality">
            Operational quality
          </SectionHeading>
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
              title="Denial"
              value={pct(stats.denialRate)}
              icon={<ShieldOff className="h-4 w-4" />}
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
              title="Consent withdrawn"
              value={stats.consentWithdrawalCount}
              icon={<ShieldOff className="h-4 w-4" />}
              description="All time"
            />
          </div>
        </section>
      )}

      {/* ── Compliance (DPO / super_admin) ──────────────────────── */}
      {stats && canSeeCompliance(role) && (
        <section aria-labelledby="dashboard-compliance" className="space-y-3">
          <SectionHeading id="dashboard-compliance">Compliance</SectionHeading>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            <StatCard
              title="Open DSRs"
              value={stats.openDsrRequests}
              icon={<ClipboardList className="h-4 w-4" />}
              description={`${stats.dsrRequests30d} in last 30d`}
            />
            <StatCard
              title="Deadline incidents"
              value={stats.incidentsApproachingDeadline}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Within 24h of NDPC deadline"
            />
            <StatCard
              title="Privacy notices"
              value={stats.privacyNoticesCount}
              icon={<FileText className="h-4 w-4" />}
            />
            <StatCard
              title="Retention policies"
              value={stats.retentionPoliciesCount}
              icon={<ClipboardList className="h-4 w-4" />}
            />
            <StatCard
              title="Sub-processors"
              value={stats.subProcessorsCount}
              icon={<Users2 className="h-4 w-4" />}
            />
          </div>
        </section>
      )}

      {/* ── Audit (auditor / DPO / super_admin) ─────────────────── */}
      {stats && canSeeAudit(role) && (
        <section aria-labelledby="dashboard-audit" className="space-y-3">
          <SectionHeading id="dashboard-audit">Audit</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Events today"
              value={stats.auditEventsToday}
              icon={<FileSearch className="h-4 w-4" />}
            />
            <StatCard
              title="Last 7 days"
              value={stats.auditEvents7d}
              icon={<FileSearch className="h-4 w-4" />}
            />
            <StatCard
              title="All time"
              value={stats.totalAuditEvents}
              icon={<FileSearch className="h-4 w-4" />}
            />
          </div>
        </section>
      )}

      {/* ── Footer: last updated ────────────────────────────────── */}
      {stats?.lastUpdated && (
        <p className="pt-2 text-xs text-muted-foreground">
          Last updated{" "}
          <time dateTime={fromUnixTime(stats.lastUpdated).toISOString()}>
            {formatDistanceToNow(fromUnixTime(stats.lastUpdated), {
              addSuffix: true,
            })}
          </time>
          {" · "}
          <span className="tabular-nums">
            {format(fromUnixTime(stats.lastUpdated), "PP p")}
          </span>
        </p>
      )}
    </div>
  );
}
