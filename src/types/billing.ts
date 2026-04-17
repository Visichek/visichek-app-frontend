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
export interface TenantUsageSummary {
  tenantId: string;
  planName: string;
  planTier: string;
  subscriptionStatus: string;
  period: string;
  crudUsage: Record<string, unknown>;
  retrievalUsage: Record<string, unknown>;
  entityCounts: Record<string, number>;
  entityCaps: Record<string, number | null>;
  storage: {
    documentsUsed: number;
    documentsLimit: number | null;
    storageMbUsed: number;
    storageMbLimit: number | null;
  };
}
