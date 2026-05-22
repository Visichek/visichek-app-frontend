"use client";

import { useMemo } from "react";
import { useCapability } from "@/features/limitations/hooks/use-limitations";

/**
 * Stable feature keys the backend ships in `deniedFeatures` on Free. Matching
 * these lets the Insights page pre-lock controls before the first response
 * lands (no flash of enabled UI). The response's
 * `meta.availableSections` / `meta.lockedSections` remain the source of truth
 * for what actually rendered — this is defense in depth, not the only gate.
 */
export const ANALYTICS_FEATURES = {
  customRange: "analytics.customRange",
  roleTabs: "analytics.roleTabs",
  hourly: "analytics.hourly",
  compliance: "analytics.compliance",
  audit: "analytics.audit",
  export: "analytics.export",
  trends: "analytics.trends",
} as const;

export interface AnalyticsGates {
  /** Custom date ranges + presets beyond the fixed Free 7-day window. */
  canCustomRange: boolean;
  /** The two role-specific tabs beyond Overview. */
  canRoleTabs: boolean;
  /** Hourly heatmap section. */
  canHourly: boolean;
  /** Incident + DSR distribution sections. */
  canCompliance: boolean;
  /** Audit time-series section. */
  canAudit: boolean;
  /** CSV/PDF export. */
  canExport: boolean;
  /** KPI window-over-window trend arrows. */
  canTrends: boolean;
  /** Range ceiling in days; null = unlimited. */
  maxRangeDays: number | null;
  /** Top-list cap; null = unlimited (server caps at 10). */
  topListMax: number | null;
  /** True on any Free plan (signup, downgrade, or dunning fallback). */
  isFreePlan: boolean;
  /** True while the limitations payload is still loading. */
  isLoading: boolean;
}

/**
 * Resolve the Insights plan gates from the shared limitations payload.
 *
 * Treats `isLoading` as "allowed" for the boolean gates (matching
 * `useCapability`) so we don't flash locked UI before limitations resolve.
 */
export function useAnalyticsGates(): AnalyticsGates {
  const cap = useCapability();

  return useMemo<AnalyticsGates>(() => {
    const maxRangeDays = cap.capFor("analyticsMaxRangeDays");
    const topListMax = cap.capFor("topListMax");
    return {
      canCustomRange: cap.can(ANALYTICS_FEATURES.customRange),
      canRoleTabs: cap.can(ANALYTICS_FEATURES.roleTabs),
      canHourly: cap.can(ANALYTICS_FEATURES.hourly),
      canCompliance: cap.can(ANALYTICS_FEATURES.compliance),
      canAudit: cap.can(ANALYTICS_FEATURES.audit),
      canExport: cap.can(ANALYTICS_FEATURES.export),
      canTrends: cap.can(ANALYTICS_FEATURES.trends),
      maxRangeDays: maxRangeDays ?? null,
      topListMax: topListMax ?? null,
      isFreePlan: cap.isFreePlan,
      isLoading: cap.isLoading,
    };
  }, [cap]);
}
