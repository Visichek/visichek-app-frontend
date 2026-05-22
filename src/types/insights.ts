import type {
  DistributionSlice,
  HourlyBucket,
  RecentCheckIn,
  TimeSeriesPoint,
  TopItem,
} from "./dashboard";
import type { SystemUserRole } from "./enums";

/**
 * Contracts for GET /v1/dashboard/insights — the range-aware, role-scoped,
 * plan-gated tenant analytics endpoint that powers the Insights page.
 *
 * Field names are camelCase (CaseConversionMiddleware). All timestamps are
 * unix EPOCH SECONDS, UTC. The section value shapes (TimeSeriesPoint,
 * DistributionSlice, HourlyBucket, TopItem, RecentCheckIn) are reused verbatim
 * from `./dashboard`, so the existing chart recipes bind directly.
 */

export type Granularity = "hour" | "day" | "week" | "month";

/** Section identifiers the Insights tabs reference. */
export type SectionId =
  | "traffic"
  | "audit"
  | "hourly"
  | "visitStatus"
  | "incident"
  | "dsr"
  | "appointment"
  | "newReturning"
  | "topDepartments"
  | "feed";

export interface InsightsMeta {
  roleView: SystemUserRole;
  departmentId: string | null;
  branchId: string | null;
  /** Tenant creation date — the minimum selectable date for the range picker. */
  tenantCreatedAt: number;
  /** First day we actually have data (>= tenantCreatedAt). */
  earliestData: number;
  /** The window the server actually used, after clamping `start` to tenure. */
  appliedRange: { start: number; stop: number };
  granularity: Granularity;
  planTier: string;
  /** Sections this plan may see for this role (data is present in `sections`). */
  availableSections: SectionId[];
  /** Sections gated behind an upgrade — no data is sent for these. */
  lockedSections: SectionId[];
  lastUpdated: number;
}

export interface KpiTrend {
  /** Percent change vs the immediately preceding window of equal length. */
  changePercent: number;
  direction: "up" | "down" | "flat";
  /** Metric-aware: an "up" trend is not always good (e.g. no-show rate). */
  isGood: boolean;
}

export interface Kpi {
  /** Stable id, e.g. "totalVisits". */
  key: string;
  label: string;
  value: number | string;
  unit?: string | null;
  /** null for live/current metrics and always null on Free. */
  trend?: KpiTrend | null;
  description: string;
}

interface SectionBase {
  title: string;
}

export interface TimeSeriesSection extends SectionBase {
  type: "timeSeries";
  points: TimeSeriesPoint[];
  valueLabel: string;
}

export interface DistributionSection extends SectionBase {
  type: "distribution";
  slices: DistributionSlice[];
  /** Present on the `incident` section to drive the NDPC deadline banner. */
  meta?: {
    pastDeadline?: number;
    approachingDeadline?: number;
  };
}

export interface HourlySection extends SectionBase {
  type: "hourly";
  buckets: HourlyBucket[];
}

export interface TopListSection extends SectionBase {
  type: "topList";
  items: TopItem[];
}

export interface FeedSection extends SectionBase {
  type: "feed";
  events: RecentCheckIn[];
}

/** Discriminated by `type`. */
export type Section =
  | TimeSeriesSection
  | DistributionSection
  | HourlySection
  | TopListSection
  | FeedSection;

export interface InsightsResponse {
  meta: InsightsMeta;
  /** Exactly 4 cards per role. */
  kpis: Kpi[];
  /** Keyed by section id; locked ids are omitted entirely. */
  sections: Partial<Record<SectionId, Section>>;
}

// ──────────────────────────────────────────────────────────────────────
// Live dashboard stream (GET /v1/dashboard/live/stream, SSE)
// ──────────────────────────────────────────────────────────────────────

/** Tenant-scoped counters pushed on the `dashboard.live` event. */
export interface DashboardLiveCounters {
  currentlyActive: number;
  awaitingCheckout: number;
  pendingApproval: number;
  checkInsToday: number;
  checkOutsToday: number;
  openIncidents: number;
  incidentsApproachingDeadline: number;
  openDsr: number;
}

export interface DashboardLiveFrame {
  counters: DashboardLiveCounters;
  meta: {
    scope: "tenant";
    role: SystemUserRole;
    tenantId: string;
    planTier: string;
    isFreeFallback: boolean;
  };
  lastUpdated: number;
}
