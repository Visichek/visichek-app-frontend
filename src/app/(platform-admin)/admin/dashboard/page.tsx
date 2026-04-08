"use client";

import {
  Building2,
  Users,
  Eye,
  CreditCard,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { QuickActions } from "@/components/platform-admin/quick-actions";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";

interface AdminDashboardStats {
  totalTenants: number;
  totalUsers: number;
  totalVisitorsThisMonth: number;
  activeSubscriptions: number;
  monthlyRevenueMinor: number;
  weeklyIncidents: number;
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: () => apiGet<AdminDashboardStats>("/admins/dashboard/stats"),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of platform activity and health"
      />

      {/* ── Quick Actions ─────────────────────────────────── */}
      <QuickActions />

      {/* ── Stats Grid ────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Platform Metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Tenants"
            value={data?.totalTenants ?? 0}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            title="Total Users"
            value={data?.totalUsers ?? 0}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            title="Visitors This Month"
            value={data?.totalVisitorsThisMonth ?? 0}
            icon={<Eye className="h-4 w-4" />}
          />
          <StatCard
            title="Active Subscriptions"
            value={data?.activeSubscriptions ?? 0}
            icon={<CreditCard className="h-4 w-4" />}
          />
          <StatCard
            title="Monthly Revenue"
            value={`₦${((data?.monthlyRevenueMinor ?? 0) / 100).toLocaleString()}`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Weekly Incidents"
            value={data?.weeklyIncidents ?? 0}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
