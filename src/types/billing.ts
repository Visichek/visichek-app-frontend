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
  priceMinor?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  description?: string;
  isPublic?: boolean;
  featureRules?: FeatureRule[];
  crudLimits?: CrudLimit[];
  retrievalQuotas?: RetrievalQuota[];
  storageLimits?: StorageLimit;
  tenantCapLimits?: TenantCapLimit;
  createdAt: number;
  updatedAt: number;
}

// ── Subscriptions ─────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialDays?: number;
  adminNotes?: string;
  featureOverrides?: Record<string, unknown>;
  crudLimitOverrides?: Record<string, unknown>;
  retrievalQuotaOverrides?: Record<string, unknown>;
  tenantCapOverrides?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
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
  type: DiscountType;
  scope: DiscountScope;
  value: number;
  status: DiscountStatus;
  maxRedemptions?: number;
  currentRedemptions?: number;
  validFrom?: number;
  validUntil?: number;
  createdAt: number;
  updatedAt: number;
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
