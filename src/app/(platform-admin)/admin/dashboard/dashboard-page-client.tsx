"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow, fromUnixTime } from "date-fns";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  LayoutDashboard,
  Loader2,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PageHeader } from "@/components/recipes/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuickActions } from "@/components/platform-admin/quick-actions";
import { AttentionPanel } from "@/features/dashboard/components/admin/attention-panel";
import { AdminActivityTab } from "@/features/dashboard/components/admin/tabs/admin-activity-tab";
import { AdminBillingTab } from "@/features/dashboard/components/admin/tabs/admin-billing-tab";
import { AdminOverviewTab } from "@/features/dashboard/components/admin/tabs/admin-overview-tab";
import { AdminRiskTab } from "@/features/dashboard/components/admin/tabs/admin-risk-tab";
import { AdminTenantsTab } from "@/features/dashboard/components/admin/tabs/admin-tenants-tab";
import { useAdminDashboardStats } from "@/features/auth/hooks/use-admin-dashboard";

type TabId = "overview" | "tenants" | "billing" | "activity" | "risk";

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Headline KPIs and recent platform activity",
  },
  {
    id: "tenants",
    label: "Tenants",
    icon: Building2,
    description: "Tenant counts, users, roles, geography, and recent signups",
  },
  {
    id: "billing",
    label: "Billing",
    icon: BadgeDollarSign,
    description:
      "Subscriptions, revenue, payments, plans, and top tenants by revenue",
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    description:
      "Cross-tenant visitor activity, time series, and traffic patterns",
  },
  {
    id: "risk",
    label: "Risk",
    icon: ShieldAlert,
    description: "Incidents, compliance, onboarding pipeline, and support load",
  },
];

export function AdminDashboardPageClient() {
  const { data, isLoading, isError, error, refetch } = useAdminDashboardStats();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const stats = data;
  if (!stats) return null;

  function handleTabChange(value: string) {
    const next = value as TabId;
    if (next === activeTab) return;
    setPendingTab(next);
    startTransition(() => {
      setActiveTab(next);
      setPendingTab(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Cross-tenant view of growth, revenue, and operational health"
      />

      {/* Issue 1: surface the operational queue at the top of the page so
          support cases, onboarding, NDPC deadlines, and content tasks
          don't get buried under analytics. */}
      <AttentionPanel stats={stats} />

      <QuickActions />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const showSpinner = isPending && pendingTab === tab.id;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2 px-4 py-2"
                title={tab.description}
              >
                {showSpinner ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div data-tutorial-anchor="admin-dashboard-metrics">
            <AdminOverviewTab stats={stats} />
          </div>
        </TabsContent>
        <TabsContent value="tenants" className="mt-6">
          <AdminTenantsTab stats={stats} />
        </TabsContent>
        <TabsContent value="billing" className="mt-6">
          <AdminBillingTab stats={stats} />
        </TabsContent>
        <TabsContent value="activity" className="mt-6">
          <AdminActivityTab stats={stats} />
        </TabsContent>
        <TabsContent value="risk" className="mt-6">
          <AdminRiskTab stats={stats} />
        </TabsContent>
      </Tabs>

      {stats.lastUpdated && (
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
