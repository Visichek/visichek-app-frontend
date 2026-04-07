"use client";

import { Building2, Users, Eye, CreditCard, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";

interface AdminDashboardStats {
  total_tenants: number;
  total_users: number;
  total_visitors_this_month: number;
  active_subscriptions: number;
  monthly_revenue_minor: number;
  weekly_incidents: number;
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: () => apiGet<AdminDashboardStats>("/admins/dashboard/stats"),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of platform activity and health"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Tenants"
          value={data?.total_tenants ?? 0}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          title="Total Users"
          value={data?.total_users ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Visitors This Month"
          value={data?.total_visitors_this_month ?? 0}
          icon={<Eye className="h-4 w-4" />}
        />
        <StatCard
          title="Active Subscriptions"
          value={data?.active_subscriptions ?? 0}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₦${((data?.monthly_revenue_minor ?? 0) / 100).toLocaleString()}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Weekly Incidents"
          value={data?.weekly_incidents ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
