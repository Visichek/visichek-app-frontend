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
  endpoint_pattern: string;
  methods: string[];
  enabled: boolean;
  description?: string;
}

export interface CrudLimit {
  collection: string;
  max_create?: number | null;
  max_update?: number | null;
  max_delete?: number | null;
  reset_interval: QuotaResetInterval;
  description?: string;
}

export interface RetrievalQuota {
  collection: string;
  max_reads?: number | null;
  reset_interval: QuotaResetInterval;
  description?: string;
}

export interface StorageLimit {
  max_documents?: number | null;
  max_storage_mb?: number | null;
  max_file_size_mb: number;
}

export interface TenantCapLimit {
  max_system_users?: number | null;
  max_departments?: number | null;
  max_branches?: number | null;
  max_visitors_per_month?: number | null;
  max_appointments_per_month?: number | null;
}

export interface Plan {
  id: string;
  name: string;
  display_name?: string;
  tier: PlanTier;
  status: PlanStatus;
  price_minor?: number;
  currency?: string;
  billing_cycle?: BillingCycle;
  description?: string;
  is_public?: boolean;
  feature_rules?: FeatureRule[];
  crud_limits?: CrudLimit[];
  retrieval_quotas?: RetrievalQuota[];
  storage_limits?: StorageLimit;
  tenant_cap_limits?: TenantCapLimit;
  created_at: number;
  updated_at: number;
}

// ── Subscriptions ─────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  trial_days?: number;
  admin_notes?: string;
  feature_overrides?: Record<string, unknown>;
  crud_limit_overrides?: Record<string, unknown>;
  retrieval_quota_overrides?: Record<string, unknown>;
  tenant_cap_overrides?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface SubscribeTenantRequest {
  tenant_id: string;
  plan_id: string;
  billing_cycle?: BillingCycle;
  discount_ids?: string[];
  trial_days?: number;
  admin_notes?: string;
  feature_overrides?: Record<string, unknown>;
  crud_limit_overrides?: Record<string, unknown>;
  retrieval_quota_overrides?: Record<string, unknown>;
  tenant_cap_overrides?: Record<string, unknown>;
}

export interface ChangePlanRequest {
  tenant_id: string;
  new_plan_id: string;
  billing_cycle?: BillingCycle;
}

export interface CancelSubscriptionRequest {
  tenant_id: string;
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
  max_redemptions?: number;
  current_redemptions?: number;
  valid_from?: number;
  valid_until?: number;
  created_at: number;
  updated_at: number;
}

// ── Invoices ──────────────────────────────────────────────────────────
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  subscription_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  billing_cycle: string;
  currency: string;
  subtotal_minor: number;
  discount_total_minor: number;
  tax_minor: number;
  total_minor: number;
  line_items: InvoiceLineItem[];
  payment_transaction_id?: string;
  issued_at?: number;
  paid_at?: number;
  period_start: number;
  period_end: number;
  pdf_object_key?: string;
  pdf_url?: string;
  provider?: string;
  date_created?: number;
  last_updated?: number;
}

// ── Payments ──────────────────────────────────────────────────────────
export interface PaymentIntentRequest {
  amount_minor: number;
  currency: string;
  reference: string;
  customer_email?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentTransaction {
  id: string;
  owner_id: string;
  provider: string;
  reference: string;
  status: string;
  amount_minor: number;
  currency: string;
  response_payload: Record<string, unknown>;
  idempotency_key: string;
  created_at: number;
  updated_at: number;
}

// ── Usage ─────────────────────────────────────────────────────────────
export interface TenantUsageSummary {
  tenant_id: string;
  plan_name: string;
  plan_tier: string;
  subscription_status: string;
  period: string;
  crud_usage: Record<string, unknown>;
  retrieval_usage: Record<string, unknown>;
  entity_counts: Record<string, number>;
  entity_caps: Record<string, number | null>;
  storage: {
    documents_used: number;
    documents_limit: number | null;
    storage_mb_used: number;
    storage_mb_limit: number | null;
  };
}
