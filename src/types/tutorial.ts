/**
 * Per-user tutorial progress (backend feature: GET/PUT /v1/tutorials).
 *
 * Progress is persisted server-side: each authenticated user has exactly
 * one record per `(tutorialType, version)`. Identity (userId/role/tenant)
 * is derived from the auth token — the client NEVER sends it. Writes are
 * synchronous (HTTP 200 returns the saved record; not a 202 queued write).
 *
 * Progress is shell-gated by the backend: a tenant user cannot record a
 * platform-admin tutorial and vice-versa (403 AUTH_ROLE_MISMATCH).
 */

/**
 * Canonical id of every tutorial the engine can mount. The frontend MUST
 * send one of these exact values on PUT — anything else is a 422.
 */
export type TutorialType =
  // ── Platform-admin shell (role = "admin") ──────────────────────────
  | "admin_dashboard_overview"
  | "tenant_onboarding_review"
  | "tenant_management"
  | "plans_setup"
  | "subscriptions_management"
  | "discounts_setup"
  | "payments_review"
  | "marketing_tools"
  | "admin_billing_overview"
  // ── Tenant shell — Receptionist ────────────────────────────────────
  | "visitor_workflow"
  | "visitor_checkout"
  | "badge_printing"
  | "appointments_today"
  // ── Tenant shell — Department Admin ────────────────────────────────
  | "appointments_management"
  | "department_settings"
  | "dept_visitor_oversight"
  // ── Tenant shell — Super Admin ─────────────────────────────────────
  | "tenant_onboarding_completion"
  | "branding_setup"
  | "user_management"
  | "branches_setup"
  | "billing_management"
  | "departments_setup"
  | "registration_qr"
  | "super_admin_visitor_log"
  // ── Tenant shell — Auditor ─────────────────────────────────────────
  | "audit_log_walkthrough"
  // ── Tenant shell — Security Officer ────────────────────────────────
  | "incident_reporting"
  | "incident_triage"
  | "ndpc_deadline_workflow"
  // ── Tenant shell — DPO ─────────────────────────────────────────────
  | "dsr_handling"
  | "retention_policies"
  | "compliance_register"
  | "consent_log_export"
  | "compliance_export"
  | "privacy_notices"
  // ── Cross-cutting (either shell, any role) ─────────────────────────
  | "getting_started"
  | "notifications_intro"
  | "data_table_basics"
  | "settings_walkthrough";

/** Per-user lifecycle of a single tutorial. */
export type TutorialStatus = "idle" | "in_progress" | "completed" | "dismissed";

/** Account discriminator stored on the record. Set server-side. */
export type TutorialUserType = "admin" | "system_user" | "user";

/**
 * The PUT request body. The server derives identity from the token, so
 * never send user_id / role / tenant_id — they are ignored.
 */
export interface TutorialProgressRequest {
  tutorialType: TutorialType;
  tutorialStatus: TutorialStatus;
  /** Defaults to 1 server-side. Bump to force a re-run of a redesign. */
  version?: number;
}

/** A single tutorial-progress record (camelCase on the wire). */
export interface TutorialOut {
  id: string;
  userId: string;
  /** Role at the time the record was written, e.g. "receptionist". */
  userRole: string;
  userType: TutorialUserType;
  tutorialType: TutorialType;
  tutorialStatus: TutorialStatus;
  version: number;
  /** null for application admins. */
  tenantId: string | null;
  /** Unix epoch seconds. */
  dateCreated: number;
  /** Unix epoch seconds. */
  lastUpdated: number;
}
