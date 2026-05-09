import {
  AlertTriangle,
  ClipboardList,
  FileSearch,
  FileText,
  ShieldAlert,
  TrendingUp,
  Users2,
} from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { StatCard } from "@/components/recipes/stat-card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import type { TenantDashboardStats } from "@/types/dashboard";

interface ComplianceTabProps {
  stats: TenantDashboardStats;
}

/**
 * Compliance + audit view. Rendered only for roles that have the data
 * (super_admin / dpo / auditor); the page client gates this.
 */
export function ComplianceTab({ stats }: ComplianceTabProps) {
  const hasIncidentTypes = stats.incidentTypeDistribution.length > 0;
  const hasIncidentStatuses = stats.incidentStatusDistribution.length > 0;
  const hasIncidentTrend = stats.incidentsLast30Days.some((p) => p.value > 0);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Data subject requests
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Open"
            value={stats.openDsrRequests}
            icon={<ClipboardList className="h-4 w-4" />}
            description="Awaiting response"
          />
          <StatCard
            title="Last 30 days"
            value={stats.dsrRequests30d}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="All time"
            value={stats.totalDsrRequests}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <StatCard
            title="Deadline incidents"
            value={stats.incidentsApproachingDeadline}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Within 24h of NDPC"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Incidents
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        </div>
        {(hasIncidentTrend || hasIncidentTypes || hasIncidentStatuses) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            {hasIncidentTypes && (
              <DistributionPie
                title="Incident type"
                data={stats.incidentTypeDistribution}
                height={220}
              />
            )}
            {hasIncidentStatuses && !hasIncidentTypes && (
              <DistributionPie
                title="Incident status"
                data={stats.incidentStatusDistribution}
                height={220}
              />
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Audit activity
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Today"
            value={stats.auditEventsToday}
            icon={<FileSearch className="h-4 w-4" />}
            description="Events recorded"
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Privacy posture
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard
            title="Privacy notices"
            value={stats.privacyNoticesCount}
            icon={<FileText className="h-4 w-4" />}
            description="Published"
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

      {stats.consentWithdrawalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {stats.consentWithdrawalCount} consent withdrawal
          {stats.consentWithdrawalCount === 1 ? "" : "s"} on record.
        </p>
      )}
    </div>
  );
}
