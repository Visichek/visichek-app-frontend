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

// ──────────────────────────────────────────────────────────────────────
// Admin (platform-wide) dashboard
// ──────────────────────────────────────────────────────────────────────

/**
 * Response shape for GET /v1/admins/dashboard/stats.
 *
 * Platform-wide aggregate across every tenant. Admin role only —
 * tenant-side roles must call /v1/dashboard/stats instead. Field naming is
 * camelCase via CaseConversionMiddleware. Numbers default to 0, lists to
 * [], so a freshly-deployed platform with zero tenants still returns a
 * fully-shaped response.
 *
 * Currency conventions:
 *  - Fields ending in `Minor` are integers in minor units (kobo / cents).
 *  - `mrr`, `arr`, `totalMonthlyRevenue`, `totalYearlyRevenue` are floats
 *    in MAJOR units (whole currency).
 *  - `revenueGrowthWow` / `revenueGrowthMom` carry minor-unit values in
 *    their `current` / `previous` fields.
 *  - The response does NOT include a currency code; render with the
 *    platform default (NGN/₦).
 */
export interface AdminDashboardStats {
  // 5.1 Tenant overview
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  newTenantsToday: number;
  newTenants7d: number;
  newTenants30d: number;
  newTenantsThisMonth: number;
  newTenantsLastMonth: number;
  tenantsGrowthWow: GrowthMetric;
  tenantsGrowthMom: GrowthMetric;

  // 5.2 User overview
  totalTenantUsers: number;
  totalApplicationUsers: number;
  totalApplicationAdmins: number;
  totalVisitorsAllTime: number;
  visitorsToday: number;
  visitors7d: number;
  visitorsThisMonth: number;
  visitorsLastMonth: number;
  visitorsGrowthMom: GrowthMetric;
  systemUserRoleBreakdown: SystemUserRoleBreakdown;

  // 5.3 Subscriptions
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  suspendedSubscriptions: number;
  cancelled30d: number;
  newSubscriptions30d: number;
  subscriptionsGrowthMom: GrowthMetric;
  /** cancelled30d / (active + trialing + cancelled30d) × 100. */
  churnRate30d: number;
  /** Active+past_due / (active + past_due + cancelled + expired) × 100, rolling 30d. */
  trialConversionRate: number;
  subscriptionBreakdown: SubscriptionStatusBreakdown;

  // 5.4 Plan analytics
  totalPlans: number;
  activePlans: number;
  archivedPlans: number;
  draftPlans: number;
  /** Top 20 plans by subscriber count. */
  planDistribution: PlanDistribution[];
  planTierDistribution: DistributionSlice[];
  billingCycleDistribution: DistributionSlice[];
  paymentProviderDistribution: DistributionSlice[];

  // 5.5 Revenue & billing
  /** Float, major units. Sum of effective_price for monthly active+trialing subs. */
  totalMonthlyRevenue: number;
  /** Float, major units. */
  totalYearlyRevenue: number;
  /** Float, major units. monthly + yearly/12. */
  mrr: number;
  /** Float, major units. mrr × 12. */
  arr: number;
  /** Integer, minor units. */
  revenue30dMinor: number;
  revenue7dMinor: number;
  revenueTodayMinor: number;
  avgInvoiceValueMinor: number;
  invoiceCount30d: number;
  paidInvoiceCount30d: number;
  failedInvoiceCount30d: number;
  invoiceStatusBreakdown: InvoiceStatusBreakdown;
  /** Values are in minor units. */
  revenueGrowthWow: GrowthMetric;
  /** Values are in minor units. */
  revenueGrowthMom: GrowthMetric;

  // 5.6 Dunning / payments
  paymentsSucceeded30d: number;
  paymentsFailed30d: number;
  paymentSuccessRate: number;
  /** Subscriptions currently in past_due. */
  dunningQueueSize: number;

  // 5.7 Incidents (cross-tenant)
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  incidentsToday: number;
  incidents30d: number;
  incidentTypeDistribution: DistributionSlice[];
  incidentStatusDistribution: DistributionSlice[];
  topTenantsByIncidents: TopTenantByIncidents[];

  // 5.8 Visitors (cross-tenant)
  visitorCheckInsToday: number;
  visitorCheckIns7d: number;
  visitorCheckIns30d: number;
  topTenantsByVisitors: TopTenantByVisitors[];
  topTenantsByActivity: TopTenantByActivity[];
  topTenantsByRevenue: TopTenantByRevenue[];

  // 5.9 Geography
  tenantsByCountry: DistributionSlice[];

  // 5.10 Onboarding pipeline
  onboardingTotal: number;
  onboardingNew: number;
  onboardingAccepted30d: number;
  onboardingRejected30d: number;
  onboardingCompleted30d: number;
  onboardingStatusDistribution: DistributionSlice[];
  onboardingAcceptanceRate: number;

  // 5.11 Support cases
  supportCasesTotal: number;
  supportCasesOpen: number;
  supportCases30d: number;
  supportStatusDistribution: DistributionSlice[];
  supportPriorityDistribution: DistributionSlice[];
  supportCategoryDistribution: DistributionSlice[];
  topTenantsBySupport: TopTenantBySupport[];

  // 5.12 Compliance / DSR
  dsrOpen: number;
  dsrTotal: number;
  dsr30d: number;
  dsrStatusDistribution: DistributionSlice[];
  incidentsApproachingDeadline: number;

  // 5.13 Time series (last 30 days, daily)
  tenantSignupsLast30Days: TimeSeriesPoint[];
  subscriptionSignupsLast30Days: TimeSeriesPoint[];
  visitorSignupsLast30Days: TimeSeriesPoint[];
  visitCheckInsLast30Days: TimeSeriesPoint[];
  /** Each point's value is in minor units. */
  revenueLast30DaysMinor: TimeSeriesPoint[];
  incidentsLast30Days: TimeSeriesPoint[];

  // 5.14 Heatmaps (last 30 days)
  hourlyDistribution: HourlyBucket[];
  dayOfWeekDistribution: DayOfWeekBucket[];

  // 5.15 Recent activity
  recentTenantSignups: TenantBriefRow[];
  /** `visitorsCount` here is the 30-day check-in count, not lifetime. */
  recentlyActiveTenants: TenantBriefRow[];

  // 5.16 Meta
  period: DashboardPeriod;
  lastUpdated: number;
  /** Legacy alias of `newTenants30d`. New code should ignore this. */
  recentSignups30d: number;
}

export interface SystemUserRoleBreakdown {
  superAdmin: number;
  deptAdmin: number;
  receptionist: number;
  auditor: number;
  securityOfficer: number;
  dpo: number;
}

export interface SubscriptionStatusBreakdown {
  active: number;
  trialing: number;
  pastDue: number;
  cancelled: number;
  suspended: number;
  expired: number;
}

export interface InvoiceStatusBreakdown {
  draft: number;
  issued: number;
  paid: number;
  void: number;
  refunded: number;
}

export interface PlanDistribution {
  planId: string;
  planName: string;
  planTier: string;
  subscriberCount: number;
  /** Float, major units. */
  monthlyRevenue: number;
  /** Float, major units. */
  yearlyRevenue: number;
  /** Share of all subscribers. */
  percentage: number;
}

export interface TopTenantByIncidents {
  tenantId: string;
  companyName: string;
  incidentCount: number;
}

export interface TopTenantByVisitors {
  tenantId: string;
  companyName: string;
  visitorCount: number;
}

export interface TopTenantByActivity {
  tenantId: string;
  companyName: string;
  checkIns30d: number;
  totalVisitSessions: number;
}

export interface TopTenantByRevenue {
  tenantId: string;
  companyName: string;
  /** Float, major units. */
  monthlyRevenue: number;
  /** Float, major units. */
  yearlyRevenue: number;
  planName: string | null;
  planTier: string | null;
  status: string | null;
}

export interface TopTenantBySupport {
  tenantId: string;
  companyName: string;
  openCases: number;
  totalCases: number;
}

export interface TenantBriefRow {
  id: string;
  companyName: string;
  isActive: boolean;
  countryOfHosting: string | null;
  dateCreated: number | null;
  planName: string | null;
  planTier: string | null;
  subscriptionStatus: string | null;
  /** Lifetime visitor count for `recentTenantSignups`; 30-day check-ins for `recentlyActiveTenants`. */
  visitorsCount: number | null;
}
