// ── Account & Login ───────────────────────────────────────────────────
export type LoginType = "GOOGLE" | "EMAIL";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

// ── Tenant User Roles ─────────────────────────────────────────────────
export type SystemUserRole =
  | "super_admin"
  | "dept_admin"
  | "receptionist"
  | "auditor"
  | "security_officer"
  | "dpo";

// ── Visitor Operations ────────────────────────────────────────────────
export type VisitStatus =
  | "registered"
  | "pending_verification"
  | "checked_in"
  | "checked_out"
  | "denied"
  | "cancelled";

export type CheckInMethod = "qr_registration" | "id_scan" | "manual_entry";
export type CheckOutMethod = "qr_scan" | "manual";
export type VerificationMethod = "id_scan" | "qr_upload" | "host_approval";
export type VerificationStatus = "verified" | "unverified" | "denied";
export type AppointmentStatus = "scheduled" | "fulfilled" | "cancelled" | "missed";
export type BadgeFormat = "A6" | "A7";
export type ProfilingPreference = "allowed" | "opted_out";

// ── Tenant & Compliance ───────────────────────────────────────────────
export type LawfulBasis = "consent" | "legitimate_interest";
export type DeletionAction = "delete" | "anonymise";
export type NoticeDisplayMode = "passive" | "active_consent";
export type DSRType = "access" | "correction" | "deletion" | "consent_withdrawal";
export type DSRStatus = "pending" | "in_progress" | "completed" | "rejected";
export type IncidentType =
  | "data_breach"
  | "unauthorized_access"
  | "data_export_exposure"
  | "device_loss"
  | "misconfiguration"
  | "third_party";
export type IncidentStatus =
  | "open"
  | "investigating"
  | "contained"
  | "reported_to_ndpc"
  | "closed";
export type LogoPosition = "top_left" | "top_center" | "top_right" | "center";
export type BranchStatus = "active" | "inactive";

// ── Plans, Billing & Quotas ───────────────────────────────────────────
export type PlanTier = "free" | "starter" | "professional" | "enterprise" | "custom";
export type PlanStatus = "draft" | "active" | "archived";
export type QuotaResetInterval = "daily" | "weekly" | "monthly" | "never";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "suspended"
  | "expired";
export type BillingCycle = "monthly" | "yearly";
export type DiscountType = "percentage" | "fixed";
export type DiscountScope = "global" | "tenant" | "plan";
export type DiscountStatus = "active" | "expired" | "disabled";
export type InvoiceStatus = "draft" | "issued" | "paid" | "void" | "refunded";

// ── Usage Tracking ────────────────────────────────────────────────────
export type OperationType = "create" | "read" | "update" | "delete";

// ── Support Cases ─────────────────────────────────────────────────────
export type SupportCaseStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "awaiting_tenant"
  | "resolved"
  | "closed"
  | "reopened";

export type SupportCasePriority = "low" | "medium" | "high" | "critical";

export type SupportCaseCategory =
  | "billing"
  | "technical"
  | "account"
  | "feature_request"
  | "data_privacy"
  | "other";

export type SupportCaseAuthorType = "tenant" | "admin" | "system";

export type SupportTier = "none" | "standard" | "priority";

// ── Async Jobs ────────────────────────────────────────────────────────
export type JobStatus = "queued" | "processing" | "succeeded" | "failed";
