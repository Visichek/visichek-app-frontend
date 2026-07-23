import type {
  PlanTier,
  PlanStatus,
  SubscriptionStatus,
  BillingCycle,
  InvoiceStatus,
  DiscountType,
  DiscountScope,
  DiscountStatus,
  QuotaResetInterval,
} from "./enums";

// ── Plans ─────────────────────────────────────────────────────────────
export interface FeatureRule {
  endpointPattern: string;
  methods: string[];
  enabled: boolean;
  description?: string;
}

/**
 * Catalog entry returned by `GET /v1/plans/features/catalog`. Drives the
 * checkboxes on the plan editor — match `endpointPattern` + `methods`
 * against `Plan.featureRules` to compute the rendered state.
 */
export interface PlanFeatureCatalogEntry {
  key: string;
  label: string;
  description: string;
  endpointPattern: string;
  methods: string[];
  defaultEnabled: boolean;
  requiresExternalConfig: boolean;
  externalConfigHint: string | null;
}

export interface CrudLimit {
  collection: string;
  maxCreate?: number | null;
  maxUpdate?: number | null;
  maxDelete?: number | null;
  resetInterval: QuotaResetInterval;
  description?: string;
}

export interface RetrievalQuota {
  collection: string;
  maxReads?: number | null;
  resetInterval: QuotaResetInterval;
  description?: string;
}

export interface StorageLimit {
  maxDocuments?: number | null;
  maxStorageMb?: number | null;
  maxFileSizeMb: number;
}

export interface TenantCapLimit {
  maxSystemUsers?: number | null;
  maxDepartments?: number | null;
  maxBranches?: number | null;
  maxVisitorsPerMonth?: number | null;
  maxAppointmentsPerMonth?: number | null;
}

export interface Plan {

  id: string;
  name: string;
  displayName?: string;
  tier: PlanTier;
  status: PlanStatus;
  basePriceMonthly: number;
  basePriceYearly: number;
  currency: string;
  description?: string;
  isPublic?: boolean;
  featureRules?: FeatureRule[];
  crudLimits?: CrudLimit[];
  retrievalQuotas?: RetrievalQuota[];
  storageLimits?: StorageLimit;
  /** Backend returns this as 'tenantCaps' */
  tenantCaps?: TenantCapLimit;
  prioritySupport?: boolean;
  slaResponseHours?: number | null;
  customBranding?: boolean;
  apiAccess?: boolean;
  sortOrder?: number;
  /**
   * Number of trial days offered when a tenant claims this plan via
   * POST /v1/trials/claim. `0` means the plan does not offer a trial.
   * Snapshotted into the trial code at claim time so admin edits do not
   * retroactively change in-flight trials.
   */
  trialDays?: number;
  dateCreated: number;
  lastUpdated: number;
}

// ── Subscriptions ─────────────────────────────────────────────────────

/** Embedded tenant summary returned on the subscription list endpoint */
export interface SubscriptionTenantEmbed {
  id: string;
  companyName: string;
  isActive: boolean;
  countryOfHosting: string | null;
  dpoContactEmail: string | null;
  defaultPaymentProvider: string | null;
  stripeCustomerId: string | null;
  flutterwaveCustomerId: string | null;
}

/** Embedded plan summary returned on the subscription list endpoint */
export interface SubscriptionPlanEmbed {
  id: string;
  name: string;
  displayName: string;
  tier: string;
  description: string | null;
  basePriceMonthly: number;
  basePriceYearly: number;
  currency: string;
  prioritySupport: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  tenantCaps: TenantCapLimit | null;
}

export interface Subscription {
  
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  effectivePrice?: number;
  currency?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  trialDays?: number;
  adminNotes?: string;
  featureOverrides?: Record<string, unknown>;
  crudLimitOverrides?: Record<string, unknown>;
  retrievalQuotaOverrides?: Record<string, unknown>;
  tenantCapOverrides?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
  /** Embedded on list responses; null if tenant record was deleted */
  tenant?: SubscriptionTenantEmbed | null;
  /** Embedded on list responses; null if plan record was deleted */
  plan?: SubscriptionPlanEmbed | null;
}

export interface SubscribeTenantRequest {
  tenantId: string;
  planId: string;
  billingCycle?: BillingCycle;
  discountIds?: string[];
  trialDays?: number;
  adminNotes?: string;
  featureOverrides?: Record<string, unknown>;
  crudLimitOverrides?: Record<string, unknown>;
  retrievalQuotaOverrides?: Record<string, unknown>;
  tenantCapOverrides?: Record<string, unknown>;
}

export interface ChangePlanRequest {
  tenantId: string;
  newPlanId: string;
  billingCycle?: BillingCycle;
}

export interface CancelSubscriptionRequest {
  tenantId: string;
  reason?: string;
  immediate?: boolean;
}

// ── Discounts ─────────────────────────────────────────────────────────
export interface Discount {
   
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discountType: DiscountType;
  scope: DiscountScope;
  value: number;
  status: DiscountStatus;
  targetTenantId?: string | null;
  targetPlanIds?: string[];
  maxRedemptions?: number | null;
  currentRedemptions?: number;
  validFrom?: number | null;
  validUntil?: number | null;
  stackable?: boolean;
  minSubscriptionValue?: number | null;
  dateCreated: number;
  lastUpdated: number;
}

// ── Invoices ──────────────────────────────────────────────────────────
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  billingCycle: string;
  currency: string;
  subtotalMinor: number;
  discountTotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  lineItems: InvoiceLineItem[];
  paymentTransactionId?: string;
  issuedAt?: number;
  paidAt?: number;
  periodStart: number;
  periodEnd: number;
  pdfObjectKey?: string;
  pdfUrl?: string;
  provider?: string;
  dateCreated?: number;
  lastUpdated?: number;
}

// ── Checkout Sessions ─────────────────────────────────────────────────
export type CheckoutSessionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

export type CheckoutProvider = "stripe" | "flutterwave" | "app";

export interface CheckoutBreakdown {
  basePrice: number;
  billingCycle: BillingCycle;
  currency: string;
  appliedDiscountIds: string[];
  totalPercentageOff: number;
  totalFixedOff: number;
  finalPrice: number;
  amountMinor: number;
}

export interface CheckoutSession {
  id: string;
  tenantId: string;
  planId: string;
  billingCycle: BillingCycle;
  currency: string;
  amountMinor: number;
  provider: CheckoutProvider;
  status: CheckoutSessionStatus;
  checkoutUrl: string | null;
  providerReference: string | null;
  providerPayload: Record<string, unknown> | null;
  breakdown: CheckoutBreakdown;
  appliedDiscountIds: string[];
  createdByUserId: string;
  expiresAt: number;
  completedAt: number | null;
  subscriptionId: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  trialDays: number;
  /** Echoed back when the session was created with a trial code. */
  trialCode?: string | null;
  dateCreated: number;
  lastUpdated: number;
}

export interface CreateCheckoutSessionRequest {
  planId: string;
  billingCycle: BillingCycle;
  discountIds?: string[];
  preferredProvider?: CheckoutProvider;
  trialDays?: number;
  /**
   * Trial code obtained from POST /v1/trials/claim. Mutually exclusive with
   * `discountIds` — passing both is a 422. When set, the server forces the
   * checkout amount to 0 and provisions a TRIALING subscription on
   * completion.
   */
  trialCode?: string;
  metadata?: Record<string, unknown>;
}

// ── Trial codes ──────────────────────────────────────────────────────
export type TrialCodeStatus = "pending" | "used" | "cancelled";

export interface TrialClaimResponse {
  code: string;
  planId: string;
  planName: string;
  planDisplayName: string;
  trialDays: number;
  /** Unix seconds — preview of when the trial would end if redeemed now. */
  trialEndsAtPreview: number;
  basePriceMonthly: number;
  basePriceYearly: number;
  currency: string;
  status: TrialCodeStatus;
}

// ── Discount preview (tenant-facing) ─────────────────────────────────
export interface DiscountPreview {
  discount: Discount;
  plan: {
    id: string;
    name: string;
    displayName: string;
    tier: PlanTier;
    currency: string;
    basePriceMonthly: number;
    basePriceYearly: number;
    trialDays: number;
  };
  billingCycle: BillingCycle;
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
  currency: string;
}

// ── Payments ──────────────────────────────────────────────────────────
export interface PaymentIntentRequest {
  amountMinor: number;
  currency: string;
  reference: string;
  customerEmail?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentTransaction {
  id: string;
  ownerId: string;
  provider: string;
  reference: string;
  status: string;
  amountMinor: number;
  currency: string;
  responsePayload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
}

// ── Usage ─────────────────────────────────────────────────────────────
/**
 * `entity_counts` from `GET /v1/usage/my-usage` (and the admin tenant
 * summary sibling). `visitorsThisMonth` is new-visitor (first-seen)
 * semantics per branch first-seen ledger; `totalCheckinsThisMonth` is
 * raw check-in activity (includes returning visitors) for dashboards
 * that want that instead. `visitorsByBranch` is keyed by branch id —
 * map ids to names via the branches list hook, falling back to the id.
 * Extra keys tolerated via the index signature for forward-compat.
 */
export interface UsageEntityCounts {
  branches?: number;
  departments?: number;
  systemUsers?: number;
  visitorsThisMonth?: number;
  visitorsByBranch?: Record<string, number>;
  totalCheckinsThisMonth?: number;
  appointmentsThisMonth?: number;
  periodStart?: number;
  periodEnd?: number;
}

/**
 * `entity_caps` — the resolved tenant's `tenant_caps` snapshot, already
 * addon-inclusive (branch add-ons folded into `maxBranches`; see
 * `plan_cache_service._apply_addon_benefits`). `visitorsPerBranchPerMonth`
 * is set on Premium+ (per-branch quota); `null`/absent means the tenant
 * is on aggregate (tenant-wide) `maxVisitorsPerMonth` accounting instead.
 */
export interface UsageEntityCaps {
  maxSystemUsers?: number | null;
  maxDepartments?: number | null;
  maxBranches?: number | null;
  maxVisitorsPerMonth?: number | null;
  maxAppointmentsPerMonth?: number | null;
  visitorsPerBranchPerMonth?: number | null;
  [key: string]: number | null | undefined;
}

export interface TenantUsageSummary {
  tenantId: string;
  planName: string;
  planTier: string;
  subscriptionStatus: string;
  period: string;
  crudUsage: Record<string, unknown>;
  retrievalUsage: Record<string, unknown>;
  /**
   * Loosely typed for backward compatibility with existing readers
   * (`pickCount`/`pickCap` helpers expect a plain `Record<string,
   * number>`). Cast to {@link UsageEntityCounts} / {@link UsageEntityCaps}
   * when reading the newer per-branch fields (`visitorsByBranch` is an
   * object, not a number, so it doesn't fit this loose shape).
   */
  entityCounts: Record<string, number>;
  entityCaps: Record<string, number | null>;
  storage: {
    documentsUsed?: number;
    documentsLimit?: number | null;
    storageMbUsed?: number;
    storageMbLimit?: number | null;
  };
}

// ── Plan Limitations (`GET /v1/me/limitations`) ───────────────────────
//
// One-shot manifest of "what is denied / what is locked under the active
// plan." The backend is the single source of truth; the frontend just
// consumes the lists. See frontend-docs/limitations.txt §2 for the
// canonical shape.

/**
 * Stable short keys for plan-gated features. Match these against
 * `Limitations.deniedFeatures` to decide whether to render a nav item or
 * action button. New keys may appear server-side without a frontend
 * release — code defensively, treat unknown strings as "denied" if you
 * see them here, and never invert the test.
 */
export type PlanFeatureKey =
  | "appointments"
  | "hosts"
  | "badges"
  | "branding"
  | "kyc"
  | "csv_export"
  | "host_email_notifications"
  | "multi_location"
  | "watchlist"
  | "sso"
  // Settings sub-sections gated on Free — backend ships these inside
  // `deniedFeatures` and the writer strips matching fields server-side
  // (see `new-limitations.txt` § "LIMITATIONS UPDATE — FIELD-LEVEL
  // FREE-PLAN GATES"). The frontend uses them to hide / lock the
  // matching block in the Advanced settings tab.
  | "email_preferences"
  | "visitor_policies"
  | "geofencing"
  // Insights analytics gates — backend ships these inside `deniedFeatures`
  // on Free so the Insights page can pre-lock controls without a round-trip
  // (see stats.txt § 7 and the backend insights notes § 6).
  | "analytics.customRange"
  | "analytics.roleTabs"
  | "analytics.hourly"
  | "analytics.compliance"
  | "analytics.audit"
  | "analytics.export"
  | "analytics.trends";

export interface LimitationsPlanSummary {
  id: string;
  name: string;
  displayName?: string;
  tier: string;
  /** True when the tenant landed on Free via cancel/dunning, not signup. */
  isFreeFallback: boolean;
  subscriptionStatus: string;
  currentPeriodEnd?: number | null;
  billingCycle?: string;
  effectivePrice?: number;
  basePriceMonthly?: number;
  basePriceYearly?: number;
  currency?: string;
}

export interface LimitationsCaps {
  maxBranches: number | null;
  maxDepartments: number | null;
  maxSystemUsers: number | null;
  maxVisitorsPerMonth: number | null;
  maxAppointmentsPerMonth: number | null;
  /** Insights range ceiling in days (Free = 7). Absent/null => unlimited. */
  analyticsMaxRangeDays?: number | null;
  /** Insights top-list cap (Free = 3). Absent/null => unlimited (server caps at 10). */
  topListMax?: number | null;
}

export interface DeniedEndpoint {
  pattern: string;
  methods: string[];
  description?: string;
}

export interface LockedEntities {
  branches: string[];
  departments: string[];
}

export interface LimitationsEnterprise {
  isEnterprise: boolean;
  /** `/v1/enterprise/<plan-name>` when isEnterprise, else null. */
  subAppPrefix: string | null;
}

/**
 * Raw active add-on summary row from `plan_data.active_addons`
 * (`services/plan_cache_service.py`), exposed on `Limitations.activeAddons`
 * for display purposes. Benefits (branch/visitor top-ups) are already
 * folded into `caps.maxBranches` — this list is not additive on top of
 * `caps`; it's the "what did they buy" summary for the UI.
 */
export interface LimitationsActiveAddon {
  kind: AddonKindLike;
  quantity: number;
  expiresAt: number | null;
}

/** Loosened to avoid a hard dependency from types/billing.ts on types/addon.ts. */
export type AddonKindLike = "storage_extension" | "visitor_quota" | "branch_quota" | string;

export interface Limitations {
  /** null for application admins (no tenant scope). */
  tenantId: string | null;
  plan: LimitationsPlanSummary | null;
  caps: LimitationsCaps;
  deniedEndpoints: DeniedEndpoint[];
  /** Stable keys — drive nav and action visibility. */
  deniedFeatures: PlanFeatureKey[] | string[];
  lockedEntities: LockedEntities;
  enterprise: LimitationsEnterprise;
  /**
   * Active add-on summary (`kind`, `quantity`, `expiresAt`). Backend:
   * `me_limitations_service.build_me_limitations` →
   * `plan_data.active_addons`. Absent/empty when the addon framework
   * isn't purchased into yet — treat as `[]`, not an error.
   */
  activeAddons?: LimitationsActiveAddon[];
}
