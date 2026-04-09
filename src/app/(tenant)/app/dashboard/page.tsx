"use client";

import { Users, UserCheck, Clock, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { QuickActions } from "@/components/tenant/quick-actions";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { apiGet } from "@/lib/api/request";

interface DashboardStats {
  checked_in_today: number;
  active_now: number;
  peak_hour: string;
  appointments_today: number;
}

export default function TenantDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tenant", "dashboard", "stats"],
    queryFn: () => apiGet<DashboardStats>("/dashboard/stats"),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Today's visitor activity at a glance"
      />

      {/* ── Quick Actions ─────────────────────────────────── */}
      <QuickActions />

      {/* ── Stats Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Checked In Today"
          value={data?.checked_in_today ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Active Now"
          value={data?.active_now ?? 0}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <StatCard
          title="Peak Hour"
          value={data?.peak_hour ?? "—"}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title="Appointments Today"
          value={data?.appointments_today ?? 0}
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
