"use client";

import { AlertTriangle, PlusCircle, Users, Building2, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavButton } from "@/components/recipes/nav-button";
import { PATHS } from "@/lib/routing/paths";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useUsageOverview,
  type UsageMeterItem,
  type UsageStatus,
} from "@/features/limitations/hooks/use-usage-overview";

const STATUS_COPY: Record<UsageStatus, string> = {
  on_track: "On track",
  approaching: "Approaching limit",
  at_limit: "At limit",
};

const STATUS_BADGE_VARIANT: Record<UsageStatus, "success" | "warning" | "destructive"> = {
  on_track: "success",
  approaching: "warning",
  at_limit: "destructive",
};

export interface UsageOverviewProps {
  className?: string;
  /**
   * Where the "Buy another branch" / upgrade CTAs should point. The real
   * add-on purchase flow ships in Task 12 — until then this deliberately
   * targets the change-plan page so the seam is a single prop to retarget,
   * not a hunt through the component.
   */
  buyBranchHref?: string;
}

function recommendationFor(item: UsageMeterItem, resource: string): string {
  if (item.status === "at_limit") {
    if (resource === "branches") {
      return "You've hit your branch limit — add a branch or upgrade your plan to open a new location.";
    }
    if (resource === "visitors") {
      return "This month's new-visitor cap is used up — upgrade your plan or add a visitor top-up to keep registering new visitors.";
    }
    if (resource === "seats") {
      return "You've used every seat on your plan — upgrade to add more team members.";
    }
    return "You're at capacity — upgrade your plan to raise this limit.";
  }
  if (item.status === "approaching") {
    return `You've used ${item.used}${item.limit ? `/${item.limit}` : ""} — keep an eye on this before it blocks new activity.`;
  }
  if (item.limit) {
    return `${item.used} of ${item.limit} used — your plan still fits.`;
  }
  return `${item.used} used — unlimited on your plan.`;
}

function MeterBar({ item }: { item: UsageMeterItem }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{item.label}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {item.used}
          {item.limit != null ? ` / ${item.limit}` : ""}
        </span>
      </div>
      <Progress value={item.percent != null ? Math.min(item.percent, 100) : 0} />
    </div>
  );
}

function StatusChip({ status }: { status: UsageStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]}>
      {status === "at_limit" && (
        <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
      )}
      {STATUS_COPY[status]}
    </Badge>
  );
}

/**
 * WS8 usage overview: New visitors / Branches / Seats / Storage cards with
 * progress bars and status chips. Rendered at the top of the change-plan
 * page (above the plan cards) and on the billing page in place of the
 * storage-only card. See Task 10 / parent plan §11.
 */
export function UsageOverview({ className, buyBranchHref }: UsageOverviewProps) {
  const overview = useUsageOverview();
  const { loadingHref } = useNavigationLoading();
  const upgradeHref = buyBranchHref ?? PATHS.APP_BILLING_CHANGE_PLAN;

  if (overview.isLoading) {
    return (
      <div className={className ?? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!overview.hasData) {
    return null;
  }

  const visitorsCard = overview.perBranch ? (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          New visitors this month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.visitorBranches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No branch activity yet this month.</p>
        ) : (
          overview.visitorBranches.map((branch) => (
            <div key={branch.id} className="space-y-1">
              <MeterBar item={branch} />
              <div className="flex items-center justify-between">
                <StatusChip status={branch.status} />
                {branch.status !== "on_track" && (
                  <span className="text-xs text-muted-foreground">
                    {recommendationFor(branch, "visitors")}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  ) : overview.visitorsAggregate ? (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          New visitors this month
        </CardTitle>
        <StatusChip status={overview.visitorsAggregate.status} />
      </CardHeader>
      <CardContent className="space-y-2">
        <MeterBar item={overview.visitorsAggregate} />
        <p className="text-xs text-muted-foreground">
          {recommendationFor(overview.visitorsAggregate, "visitors")}
        </p>
      </CardContent>
    </Card>
  ) : null;

  const isUpgradeLoading = loadingHref === upgradeHref;

  return (
    <div className={className ?? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"}>
      {visitorsCard}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Branches
          </CardTitle>
          <StatusChip status={overview.branches.status} />
        </CardHeader>
        <CardContent className="space-y-3">
          <MeterBar item={overview.branches} />
          <p className="text-xs text-muted-foreground">
            {recommendationFor(overview.branches, "branches")}
          </p>
          {overview.branchesAtCap && (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={upgradeHref}
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] w-full"
                >
                  <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isUpgradeLoading ? "Loading…" : "Buy another branch"}
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Go to the change-plan page to add branch capacity to your organization
              </TooltipContent>
            </Tooltip>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Seats
          </CardTitle>
          <StatusChip status={overview.seats.status} />
        </CardHeader>
        <CardContent className="space-y-2">
          <MeterBar item={overview.seats} />
          <p className="text-xs text-muted-foreground">
            {recommendationFor(overview.seats, "seats")}
          </p>
        </CardContent>
      </Card>

      {overview.storage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Storage
            </CardTitle>
            <StatusChip status={overview.storage.status} />
          </CardHeader>
          <CardContent className="space-y-2">
            <MeterBar item={overview.storage} />
            <p className="text-xs text-muted-foreground">
              {recommendationFor(overview.storage, "storage")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
