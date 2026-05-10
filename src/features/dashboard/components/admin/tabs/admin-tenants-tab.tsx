import {
  Building2,
  ClipboardList,
  Eye,
  Globe,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { StatGroup } from "@/components/recipes/stat-group";
import { GrowthRow } from "@/features/dashboard/components/growth-row";
import { AdminTenantBriefTable } from "@/features/dashboard/components/admin/admin-tenant-brief-table";
import type { AdminDashboardStats, GrowthMetric } from "@/types/dashboard";

interface AdminTenantsTabProps {
  stats: AdminDashboardStats;
}

function asTrend(metric: GrowthMetric | undefined) {
  if (!metric || metric.changePercent === 0) return undefined;
  return {
    value: metric.changePercent,
    isPositive: metric.changePercent >= 0,
  };
}

export function AdminTenantsTab({ stats }: AdminTenantsTabProps) {
  return (
    <div className="space-y-6">
      <StatGroup
        title="Tenant counts"
        items={[
          {
            label: "Total",
            value: stats.totalTenants,
            icon: <Building2 className="h-4 w-4" />,
          },
          {
            label: "Active",
            value: stats.activeTenants,
            icon: <Building2 className="h-4 w-4" />,
            tone: "success",
          },
          {
            label: "Inactive",
            value: stats.inactiveTenants,
            icon: <Building2 className="h-4 w-4" />,
          },
          {
            label: "New today",
            value: stats.newTenantsToday,
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "New (7d)",
            value: stats.newTenants7d,
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "New (30d)",
            value: stats.newTenants30d,
            icon: <TrendingUp className="h-4 w-4" />,
            trend: asTrend(stats.tenantsGrowthMom),
            description: "vs last month",
          },
        ]}
        columns={6}
      />

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

      <StatGroup
        title="People"
        description="Across all tenants"
        items={[
          {
            label: "Tenant users",
            value: stats.totalTenantUsers,
            icon: <Users className="h-4 w-4" />,
            description: "All system users",
          },
          {
            label: "Application users",
            value: stats.totalApplicationUsers,
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: "App admins",
            value: stats.totalApplicationAdmins,
            icon: <UserCheck className="h-4 w-4" />,
          },
          {
            label: "Visitors (lifetime)",
            value: stats.totalVisitorsAllTime,
            icon: <Eye className="h-4 w-4" />,
          },
        ]}
        columns={4}
      />

      <StatGroup
        title="System user roles"
        description="Distribution of staff seats across tenants"
        items={[
          {
            label: "Super admins",
            value: stats.systemUserRoleBreakdown.superAdmin,
            icon: <UserCheck className="h-4 w-4" />,
          },
          {
            label: "Dept admins",
            value: stats.systemUserRoleBreakdown.deptAdmin,
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: "Receptionists",
            value: stats.systemUserRoleBreakdown.receptionist,
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: "Auditors",
            value: stats.systemUserRoleBreakdown.auditor,
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: "Security officers",
            value: stats.systemUserRoleBreakdown.securityOfficer,
            icon: <ShieldAlert className="h-4 w-4" />,
          },
          {
            label: "DPOs",
            value: stats.systemUserRoleBreakdown.dpo,
            icon: <ClipboardList className="h-4 w-4" />,
          },
        ]}
        columns={6}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DistributionPie
            title="Tenants by country"
            description="Active tenants by hosting country"
            data={stats.tenantsByCountry}
            height={240}
          />
        </div>
        <StatGroup
          items={[
            {
              label: "Countries represented",
              value: stats.tenantsByCountry.length,
              icon: <Globe className="h-4 w-4" />,
            },
          ]}
          columns={2}
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
