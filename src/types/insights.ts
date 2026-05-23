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

/**
 * A single active filter, resolved server-side for display as a chip. `key` is
 * the camelCase filter field (e.g. "branchId", "subscriptionStatus") so the FE
 * can drop it from its filter state on removal; `label` is the resolved value
 * label (entity name or humanised enum).
 */
export interface AppliedFilter {
  key: string;
  label: string;
}

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
  /** Active filters resolved to display labels (chips). */
  appliedFilters?: AppliedFilter[];
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
  /** NDPC deadline counters — drives the red banner (admin Risk `incidents`). */
  meta?: {
    pastDeadline?: number;
    approachingDeadline?: number;
  };
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

/**
 * Tabular section — admin-only (top-revenue tenants, recent signups, etc.).
 * Rows are flat camelCase objects; `columns` is the ordered list of keys to
 * render. The renderer formats money/date columns heuristically by key name.
 */
export interface TableSection extends SectionBase {
  type: "table";
  rows: Array<Record<string, string | number | null>>;
  columns: string[];
  /** NDPC deadline counters — drives the red banner (admin incident table). */
  meta?: {
    pastDeadline?: number;
    approachingDeadline?: number;
  };
}

/** Discriminated by `type`. */
export type Section =
  | TimeSeriesSection
  | DistributionSection
  | HourlySection
  | TopListSection
  | FeedSection
  | TableSection;

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

// ──────────────────────────────────────────────────────────────────────
// Platform-admin insights (GET /v1/admins/dashboard/insights)
// Same engine as the tenant contract; platform-wide lower bound; no plan
// gating. Reuses Kpi / Section shapes above.
// ──────────────────────────────────────────────────────────────────────

export type AdminTabId = "overview" | "tenants" | "billing" | "activity" | "risk";

export interface AdminInsightsMeta {
  /** First tenant's creation date — the range-picker lower bound. */
  platformLaunchAt: number;
  /** First day with platform data (>= platformLaunchAt). */
  earliestData: number;
  appliedRange: { start: number; stop: number };
  granularity: Granularity;
  tab: AdminTabId;
  /** Active filters resolved to display labels (chips). */
  appliedFilters?: AppliedFilter[];
  lastUpdated: number;
}

export interface AdminInsightsResponse {
  meta: AdminInsightsMeta;
  kpis: Kpi[];
  /** Keyed by admin section id (strings — see admin-stats.txt § 6). */
  sections: Record<string, Section>;
}

/** Admin live SSE counters (scope === "admin"). */
export interface AdminDashboardLiveCounters {
  openIncidents: number;
  criticalIncidents: number;
  incidentsToday: number;
  visitorCheckInsToday: number;
  newTenantsToday: number;
  supportCasesOpen: number;
  dsrOpen: number;
}
