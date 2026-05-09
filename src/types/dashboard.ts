import type {
  AppointmentStatus,
  BadgeFormat,
  CheckInMethod,
  CheckOutMethod,
  IncidentStatus,
  IncidentType,
  SystemUserRole,
  VerificationMethod,
  VerificationStatus,
  VisitStatus,
} from "./enums";

/**
 * Response shape for GET /v1/dashboard/stats.
 *
 * The backend returns one comprehensive payload — see the dashboard-stats
 * doc for field-level provenance. Field names are camelCase because of the
 * server-side CaseConversionMiddleware. Numbers default to 0 and lists to
 * [] for new tenants, so every section is safe to render unconditionally.
 */
export interface TenantDashboardStats {
  // 1. Overview KPIs
  totalVisits: number;
  totalVisitors: number;
  totalAppointments: number;
  totalDepartments: number;
  totalBranches: number;
  totalSystemUsers: number;
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;

  // 2. Live state
  currentlyActive: number;
  awaitingCheckout: number;
  pendingApproval: number;
  pendingKyc: number;

  // 3. Today snapshot
  visitorsToday: number;
  checkInsToday: number;
  checkOutsToday: number;
  expectedToday: number;
  newVisitorsToday: number;
  returningVisitorsToday: number;
  denialsToday: number;
  incidentsToday: number;
  /** UTC hour 0–23 with the highest check-in count today, or null if none. */
  peakHourToday: number | null;

  // 4. Period totals
  visitsThisWeek: number;
  visitsLastWeek: number;
  visitsThisMonth: number;
  visitsLastMonth: number;
  visitsThisQuarter: number;
  visitsThisYear: number;

  // 5. Growth
  visitsGrowthDod: GrowthMetric;
  visitsGrowthWow: GrowthMetric;
  visitsGrowthMom: GrowthMetric;
  signupsGrowthWow: GrowthMetric;
  signupsGrowthMom: GrowthMetric;

  // 6. Visit duration
  avgVisitDurationSeconds: number;
  avgVisitDurationMinutes: number;
  longestVisitTodayMinutes: number;
  shortestVisitTodayMinutes: number;
  overdueCheckouts: number;

  // 7. Visitor acquisition
  newSignupsToday: number;
  newSignups7d: number;
  newSignups30d: number;
  newSignupsThisMonth: number;
  newSignupsLastMonth: number;
  returningVisitorCount: number;
  vipVisitorCount: number;
  visitorRetentionRate: number;
  newVsReturning: DistributionSlice[];

  // 8. Pie-chart distributions
  visitStatusDistribution: DistributionSlice<VisitStatus>[];
  checkInMethodDistribution: DistributionSlice<CheckInMethod>[];
  checkOutMethodDistribution: DistributionSlice<CheckOutMethod>[];
  verificationStatusDistribution: DistributionSlice<VerificationStatus>[];
  verificationMethodDistribution: DistributionSlice<VerificationMethod>[];
  consentDistribution: DistributionSlice[];
  badgeFormatDistribution: DistributionSlice<BadgeFormat>[];
  purposeDistribution: DistributionSlice[];
  appointmentStatusDistribution: DistributionSlice<AppointmentStatus>[];
  incidentTypeDistribution: DistributionSlice<IncidentType>[];
  incidentStatusDistribution: DistributionSlice<IncidentStatus>[];
  kycStatusDistribution: DistributionSlice[];

  // 9. Top lists (capped at 10 entries; denial reasons capped at 5)
  topDepartments: TopItem[];
  topHosts: TopItem[];
  topCompanies: TopItem[];
  topVisitors: TopItem[];
  topBranches: TopItem[];
  topPurposes: TopItem[];
  topDenialReasons: TopItem[];
  topCheckInMethods: TopItem[];

  // 10. Time series (zero-filled daily buckets at UTC midnight)
  visitsLast7Days: TimeSeriesPoint[];
  visitsLast30Days: TimeSeriesPoint[];
  checkOutsLast7Days: TimeSeriesPoint[];
  signupsLast30Days: TimeSeriesPoint[];
  appointmentsLast30Days: TimeSeriesPoint[];
  incidentsLast30Days: TimeSeriesPoint[];

  // 11. Heatmaps (last 30 days)
  hourlyDistribution: HourlyBucket[];
  dayOfWeekDistribution: DayOfWeekBucket[];

  // 12. Appointment funnel
  appointmentsScheduled: number;
  appointmentsFulfilled: number;
  appointmentsMissed: number;
  appointmentsCancelled: number;
  appointmentFulfillmentRate: number;
  appointmentNoShowRate: number;
  appointmentConversionRate: number;

  // 13. Operational quality
  verificationRate: number;
  consentRate: number;
  consentWithdrawalCount: number;
  denialRate: number;
  badgeIssueRate: number;
  avgKycPassRate: number;

  // 14. Real-time samples (capped at 10)
  recentCheckIns: RecentCheckIn[];
  upcomingAppointmentsToday: UpcomingAppointment[];

  // 15. Compliance
  openDsrRequests: number;
  totalDsrRequests: number;
  dsrRequests30d: number;
  incidentsApproachingDeadline: number;
  privacyNoticesCount: number;
  retentionPoliciesCount: number;
  subProcessorsCount: number;

  // 16. Audit
  totalAuditEvents: number;
  auditEventsToday: number;
  auditEvents7d: number;

  // 17. Meta
  roleView: SystemUserRole | "admin";
  departmentId: string | null;
  period: DashboardPeriod;
  lastUpdated: number;
}

/**
 * One slice of a pie/bar distribution. `value=0` slices are omitted server-side,
 * so an empty distribution renders as the chart's empty state.
 */
export interface DistributionSlice<TKey extends string = string> {
  /** Raw enum value or grouping key. */
  key: TKey;
  /** Humanised label (already capitalised / spaced server-side). */
  label: string;
  value: number;
  /** Rounded to 1 decimal; slices sum to ~100. */
  percentage: number;
}

/**
 * One row of a top-N list. `id` is null for free-form groupings (e.g. company
 * name strings). `extra` carries display-only metadata that varies by list.
 */
export interface TopItem {
  id: string | null;
  label: string;
  value: number;
  /** Share of the top-N total. */
  percentage: number;
  extra?: Record<string, unknown>;
}

/** Daily-bucket time-series point. `timestamp` is unix seconds at UTC midnight. */
export interface TimeSeriesPoint {
  timestamp: number;
  /** YYYY-MM-DD. */
  label: string;
  value: number;
}

/** One hour of the day, 0–23. */
export interface HourlyBucket {
  hour: number;
  /** "HH:00". */
  label: string;
  value: number;
}

/** One day of the week, 0=Mon … 6=Sun. */
export interface DayOfWeekBucket {
  day: number;
  /** "Mon"…"Sun". */
  label: string;
  value: number;
}

/** Current vs previous window with absolute and percent deltas. */
export interface GrowthMetric {
  current: number;
  previous: number;
  change: number;
  /**
   * `((current - previous) / previous) * 100`, rounded to 1 decimal.
   * When `previous == 0`: 100.0 if current > 0, else 0.0.
   */
  changePercent: number;
}

export interface RecentCheckIn {
  sessionId: string;
  visitorName: string;
  company: string | null;
  hostName: string | null;
  status: VisitStatus;
  checkInTime: number;
  durationMinutes: number | null;
  verified: boolean;
}

export interface UpcomingAppointment {
  appointmentId: string;
  visitorName: string;
  hostName: string | null;
  scheduledDatetime: number;
  status: AppointmentStatus;
}

/** All boundaries are unix seconds UTC. */
export interface DashboardPeriod {
  now: number;
  startToday: number;
  startWeek: number;
  startMonth: number;
  startQuarter: number;
  startYear: number;
}
