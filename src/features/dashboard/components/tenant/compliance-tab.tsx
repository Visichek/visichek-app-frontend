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
import { StatGroup } from "@/components/recipes/stat-group";
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
  // Free-plan responses null these fields out — treat null/undefined as
  // "no data" rather than crashing on .length / .some.
  const hasIncidentTypes = (stats.incidentTypeDistribution?.length ?? 0) > 0;
  const hasIncidentStatuses = (stats.incidentStatusDistribution?.length ?? 0) > 0;
  const hasIncidentTrend =
    stats.incidentsLast30Days?.some((p) => p.value > 0) ?? false;

  return (
    <div className="space-y-6">
      <StatGroup
        title="Data subject requests"
        items={[
          {
            label: "Open",
            value: stats.openDsrRequests,
            description: "Awaiting response",
            icon: <ClipboardList className="h-4 w-4" />,
            tone: stats.openDsrRequests > 0 ? "warning" : "default",
          },
          {
            label: "Last 30d",
            value: stats.dsrRequests30d,
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "All time",
            value: stats.totalDsrRequests,
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
        ]}
        columns={4}
      />

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

      <StatGroup
        title="Audit activity"
        items={[
          {
            label: "Today",
            value: stats.auditEventsToday,
            description: "Events recorded",
            icon: <FileSearch className="h-4 w-4" />,
          },
          {
            label: "Last 7d",
            value: stats.auditEvents7d,
            icon: <FileSearch className="h-4 w-4" />,
          },
          {
            label: "All time",
            value: stats.totalAuditEvents,
            icon: <FileSearch className="h-4 w-4" />,
          },
        ]}
        columns={3}
      />

      <StatGroup
        title="Privacy posture"
        items={[
          {
            label: "Privacy notices",
            value: stats.privacyNoticesCount,
            description: "Published",
            icon: <FileText className="h-4 w-4" />,
          },
          {
            label: "Retention policies",
            value: stats.retentionPoliciesCount,
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: "Sub-processors",
            value: stats.subProcessorsCount,
            icon: <Users2 className="h-4 w-4" />,
          },
        ]}
        columns={3}
      />

      {stats.consentWithdrawalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {stats.consentWithdrawalCount} consent withdrawal
          {stats.consentWithdrawalCount === 1 ? "" : "s"} on record.
        </p>
      )}
    </div>
  );
}
