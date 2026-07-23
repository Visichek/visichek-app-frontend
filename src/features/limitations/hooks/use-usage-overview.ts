"use client";

import { useMemo } from "react";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { useLimitations } from "@/features/limitations/hooks/use-limitations";
import { useBranches } from "@/features/branches/hooks/use-branches";
import type {
  LimitationsActiveAddon,
  UsageEntityCaps,
  UsageEntityCounts,
} from "@/types/billing";

/** <70% = healthy, 70–99% = warn, >=100% = blocked. Task 10 / parent plan §11. */
export type UsageStatus = "on_track" | "approaching" | "at_limit";

export interface UsageMeterItem {
  id: string;
  label: string;
  used: number;
  /** `null` = unlimited (no cap set for this plan/addon combination). */
  limit: number | null;
  status: UsageStatus;
  /** 0–100+ (uncapped past 100 so callers can clamp per their own bar). `null` when unlimited. */
  percent: number | null;
}

export interface VisitorUsageBranchItem extends UsageMeterItem {
  branchId: string;
}

export interface UsageOverviewData {
  isLoading: boolean;
  isError: boolean;
  /** True once at least the usage summary has loaded. */
  hasData: boolean;
  /**
   * True when `visitorsPerBranchPerMonth` is set on the resolved tenant
   * caps (Premium+) — render per-branch mini-bars. False = aggregate,
   * tenant-wide accounting (Free/Starter today).
   */
  perBranch: boolean;
  visitorBranches: VisitorUsageBranchItem[];
  visitorsAggregate: UsageMeterItem | null;
  branches: UsageMeterItem;
  seats: UsageMeterItem;
  storage: UsageMeterItem | null;
  /** Raw add-on summary rows for display; `[]` when the addon framework isn't wired/purchased. */
  activeAddons: LimitationsActiveAddon[];
  /** Drives the "Buy another branch" CTA. */
  branchesAtCap: boolean;
}

function meter(
  id: string,
  label: string,
  used: number,
  limit: number | null | undefined,
): UsageMeterItem {
  const normalizedLimit = limit === undefined ? null : limit;
  if (normalizedLimit === null || normalizedLimit <= 0) {
    return { id, label, used, limit: null, status: "on_track", percent: null };
  }
  const percent = (used / normalizedLimit) * 100;
  const status: UsageStatus =
    percent >= 100 ? "at_limit" : percent >= 70 ? "approaching" : "on_track";
  return { id, label, used, limit: normalizedLimit, status, percent };
}

/**
 * Composes `useMyUsage()` + `useLimitations()` (+ branch names) into the
 * shape `<UsageOverview>` renders. See Task 10 / parent plan §11.
 */
export function useUsageOverview(): UsageOverviewData {
  const usageQuery = useMyUsage();
  const limitationsQuery = useLimitations();
  const branchesQuery = useBranches();

  return useMemo(() => {
    const usage = usageQuery.data;
    const limitations = limitationsQuery.data;
    const isLoading = usageQuery.isLoading || limitationsQuery.isLoading;
    const isError = usageQuery.isError || limitationsQuery.isError;

    // `entityCounts`/`entityCaps` are typed as plain `Record<string, number>`
    // for backward compatibility with existing readers; the newer
    // per-branch fields (`visitorsByBranch` is an object, not a number)
    // don't fit that loose shape, so read them through the richer types.
    const counts = (usage?.entityCounts ?? {}) as unknown as UsageEntityCounts;
    const caps = (usage?.entityCaps ?? {}) as unknown as UsageEntityCaps;

    const branchNameById = new Map<string, string>();
    for (const b of branchesQuery.data?.items ?? []) {
      branchNameById.set(b.id, b.name);
    }

    const perBranchCap = caps.visitorsPerBranchPerMonth ?? null;
    const perBranch = perBranchCap !== null && perBranchCap !== undefined;

    const visitorsByBranch = counts.visitorsByBranch ?? {};
    const visitorBranches: VisitorUsageBranchItem[] = perBranch
      ? Object.entries(visitorsByBranch).map(([branchId, used]) => ({
          branchId,
          ...meter(
            `visitors-branch-${branchId}`,
            branchNameById.get(branchId) ?? branchId,
            used,
            perBranchCap,
          ),
        }))
      : [];

    const aggregateUsed = counts.visitorsThisMonth ?? 0;
    // Resolved via `useLimitations()` first — that cap is already
    // addon-inclusive (branch/visitor top-ups folded in server-side).
    const aggregateLimit =
      limitations?.caps?.maxVisitorsPerMonth ?? caps.maxVisitorsPerMonth ?? null;
    const visitorsAggregate: UsageMeterItem | null = perBranch
      ? null
      : meter("visitors-aggregate", "New visitors this month", aggregateUsed, aggregateLimit);

    const branchesUsed = counts.branches ?? 0;
    const branchesLimit = limitations?.caps?.maxBranches ?? caps.maxBranches ?? null;
    const branches = meter("branches", "Branches", branchesUsed, branchesLimit);

    const seatsUsed = counts.systemUsers ?? 0;
    const seatsLimit = limitations?.caps?.maxSystemUsers ?? caps.maxSystemUsers ?? null;
    const seats = meter("seats", "Seats", seatsUsed, seatsLimit);

    let storage: UsageMeterItem | null = null;
    if (usage?.storage && typeof usage.storage.documentsUsed === "number") {
      storage = meter(
        "storage",
        "Storage (documents)",
        usage.storage.documentsUsed,
        usage.storage.documentsLimit ?? null,
      );
    }

    const activeAddons = limitations?.activeAddons ?? [];

    return {
      isLoading,
      isError,
      hasData: !!usage,
      perBranch,
      visitorBranches,
      visitorsAggregate,
      branches,
      seats,
      storage,
      activeAddons,
      branchesAtCap: branches.status === "at_limit",
    };
  }, [
    usageQuery.data,
    usageQuery.isLoading,
    usageQuery.isError,
    limitationsQuery.data,
    limitationsQuery.isLoading,
    limitationsQuery.isError,
    branchesQuery.data,
  ]);
}
