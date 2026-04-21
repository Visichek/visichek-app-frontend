/**
 * Capability constants used for fine-grained permission checks.
 * Map roles to capabilities, then check capabilities in guards and UI.
 */
export const CAPABILITIES = {
  // Visitor operations
  VISITOR_CHECK_IN: "visitor:check_in",
  VISITOR_CHECK_OUT: "visitor:check_out",
  VISITOR_VIEW_ACTIVE: "visitor:view_active",
  VISITOR_VIEW_SESSIONS: "visitor:view_sessions",
  VISITOR_VIEW_PROFILES: "visitor:view_profiles",
  VISITOR_EDIT_PROFILE: "visitor:edit_profile",

  // Check-in approval (pending → approved/rejected)
  CHECKIN_APPROVE: "checkin:approve",
  CHECKIN_VIEW: "checkin:view",

  // Check-in config management
  CHECKIN_CONFIG_VIEW: "checkin_config:view",
  CHECKIN_CONFIG_EDIT: "checkin_config:edit",

  // Appointments
  APPOINTMENT_CREATE: "appointment:create",
  APPOINTMENT_VIEW: "appointment:view",
  APPOINTMENT_EDIT: "appointment:edit",
  APPOINTMENT_DELETE: "appointment:delete",

  // Departments
  DEPARTMENT_CREATE: "department:create",
  DEPARTMENT_VIEW: "department:view",
  DEPARTMENT_EDIT: "department:edit",
  DEPARTMENT_DELETE: "department:delete",

  // Branches
  BRANCH_CREATE: "branch:create",
  BRANCH_VIEW: "branch:view",
  BRANCH_EDIT: "branch:edit",
  BRANCH_DELETE: "branch:delete",

  // User management
  USER_CREATE: "user:create",
  USER_VIEW: "user:view",
  USER_EDIT: "user:edit",
  USER_DELETE: "user:delete",

  // Branding
  BRANDING_VIEW: "branding:view",
  BRANDING_EDIT: "branding:edit",

  // Billing
  BILLING_VIEW: "billing:view",
  BILLING_MANAGE: "billing:manage",

  // Incidents
  INCIDENT_CREATE: "incident:create",
  INCIDENT_VIEW: "incident:view",
  INCIDENT_EDIT: "incident:edit",

  // Audit
  AUDIT_VIEW: "audit:view",
  AUDIT_EXPORT: "audit:export",

  // DPO / Compliance
  DSR_CREATE: "dsr:create",
  DSR_VIEW: "dsr:view",
  DSR_EDIT: "dsr:edit",
  RETENTION_VIEW: "retention:view",
  RETENTION_EDIT: "retention:edit",
  SUB_PROCESSOR_VIEW: "subProcessor:view",
  SUB_PROCESSOR_EDIT: "subProcessor:edit",
  PRIVACY_NOTICE_VIEW: "privacyNotice:view",
  PRIVACY_NOTICE_EDIT: "privacyNotice:edit",
  COMPLIANCE_REGISTER_VIEW: "compliance_register:view",
  COMPLIANCE_REGISTER_EDIT: "compliance_register:edit",

  // Dashboard
  DASHBOARD_VIEW: "dashboard:view",

  // Tenant config
  TENANT_CONFIG_VIEW: "tenant_config:view",
  TENANT_CONFIG_EDIT: "tenant_config:edit",

  // Support cases (tenant side — all 6 tenant roles can open & participate)
  SUPPORT_CASE_CREATE: "support_case:create",
  SUPPORT_CASE_VIEW: "support_case:view",
  SUPPORT_CASE_REPLY: "support_case:reply",
  SUPPORT_CASE_CLOSE: "support_case:close",
  SUPPORT_CASE_REOPEN: "support_case:reopen",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
