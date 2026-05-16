"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow, fromUnixTime } from "date-fns";
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Users,
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
import { QuickActions } from "@/components/tenant/quick-actions";
import { hasCapability as roleHasCapability } from "@/lib/permissions/roles";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { ComplianceTab } from "@/features/dashboard/components/tenant/compliance-tab";
import { OperationsTab } from "@/features/dashboard/components/tenant/operations-tab";
import { OverviewTab } from "@/features/dashboard/components/tenant/overview-tab";
import { VisitorsTab } from "@/features/dashboard/components/tenant/visitors-tab";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import type { TenantDashboardStats } from "@/types/dashboard";

type TabId = "overview" | "visitors" | "operations" | "compliance";

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  description: string;
}

const BASE_TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Headline KPIs, live state, and recent activity",
  },
  {
    id: "visitors",
    label: "Visitors",
    icon: Users,
    description: "Visitor base, signups, distributions, and top performers",
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    description: "Today, appointments, quality metrics, and traffic patterns",
  },
];

const COMPLIANCE_TAB: TabConfig = {
  id: "compliance",
  label: "Compliance",
  icon: ClipboardList,
  description: "DSRs, incidents, audit activity, and privacy posture",
};

/**
 * Tenant dashboard's Compliance tab visibility (Issue 17 sweep).
 *
 * Previously a hard list of `super_admin | dpo | auditor`. Replaced
 * with a capability check so the role list stays consistent with the
 * rest of the app's permission map. Anyone who can view DSRs or the
 * audit trail belongs on the compliance tab; if a future role gets
 * either capability they'll automatically show the tab without
 * editing this file.
 *
 * Uses the role-keyed helper from `lib/permissions/roles.ts` because
 * the input here is the server-reported `roleView`, not the live
 * session's `currentRole`.
 */
function canSeeCompliance(role: TenantDashboardStats["roleView"]): boolean {
  return (
    roleHasCapability(role, CAPABILITIES.DSR_VIEW) ||
    roleHasCapability(role, CAPABILITIES.AUDIT_VIEW)
  );
}

export function DashboardPageClient() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const stats = data;
  if (!stats) return null;

  const tabs = canSeeCompliance(stats.roleView)
    ? [...BASE_TABS, COMPLIANCE_TAB]
    : BASE_TABS;

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
        title="Dashboard"
        description="Visitor activity, operations, and compliance"
      />

      <QuickActions />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          {tabs.map((tab) => {
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
          <OverviewTab stats={stats} />
        </TabsContent>
        <TabsContent value="visitors" className="mt-6">
          <VisitorsTab stats={stats} />
        </TabsContent>
        <TabsContent value="operations" className="mt-6">
          <OperationsTab stats={stats} />
        </TabsContent>
        {canSeeCompliance(stats.roleView) && (
          <TabsContent value="compliance" className="mt-6">
            <ComplianceTab stats={stats} />
          </TabsContent>
        )}
      </Tabs>

      {stats.lastUpdated && (
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
