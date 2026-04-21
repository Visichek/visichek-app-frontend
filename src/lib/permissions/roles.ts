import type { SystemUserRole } from "@/types/enums";
import { CAPABILITIES, type Capability } from "./capabilities";

const C = CAPABILITIES;

/**
 * Map each tenant role to its granted capabilities.
 * This is the single source of truth for what each role can do.
 */
export const ROLE_CAPABILITIES: Record<SystemUserRole, Capability[]> = {
  super_admin: Object.values(C), // super_admin has all capabilities

  dept_admin: [
    C.VISITOR_CHECK_IN,
    C.VISITOR_CHECK_OUT,
    C.VISITOR_VIEW_ACTIVE,
    C.VISITOR_VIEW_SESSIONS,
    C.VISITOR_VIEW_PROFILES,
    C.VISITOR_EDIT_PROFILE,
    C.CHECKIN_VIEW,
    C.CHECKIN_APPROVE,
    C.CHECKIN_CONFIG_VIEW,
    C.CHECKIN_CONFIG_EDIT,
    C.APPOINTMENT_CREATE,
    C.APPOINTMENT_VIEW,
    C.APPOINTMENT_EDIT,
    C.APPOINTMENT_DELETE,
    C.DEPARTMENT_VIEW,
    C.DEPARTMENT_EDIT,
    C.DASHBOARD_VIEW,
    C.SUPPORT_CASE_CREATE,
    C.SUPPORT_CASE_VIEW,
    C.SUPPORT_CASE_REPLY,
    C.SUPPORT_CASE_CLOSE,
    C.SUPPORT_CASE_REOPEN,
  ],

  receptionist: [
    C.VISITOR_CHECK_IN,
    C.VISITOR_CHECK_OUT,
    C.VISITOR_VIEW_ACTIVE,
    C.VISITOR_VIEW_PROFILES,
    C.VISITOR_EDIT_PROFILE,
    C.CHECKIN_VIEW,
    C.CHECKIN_APPROVE,
    C.APPOINTMENT_CREATE,
    C.APPOINTMENT_VIEW,
    C.APPOINTMENT_EDIT,
    C.DASHBOARD_VIEW,
    C.SUPPORT_CASE_CREATE,
    C.SUPPORT_CASE_VIEW,
    C.SUPPORT_CASE_REPLY,
    C.SUPPORT_CASE_CLOSE,
    C.SUPPORT_CASE_REOPEN,
  ],

  auditor: [
    C.AUDIT_VIEW,
    C.AUDIT_EXPORT,
    C.VISITOR_VIEW_SESSIONS,
    C.VISITOR_VIEW_PROFILES,
    C.DASHBOARD_VIEW,
    C.SUPPORT_CASE_CREATE,
    C.SUPPORT_CASE_VIEW,
    C.SUPPORT_CASE_REPLY,
    C.SUPPORT_CASE_CLOSE,
    C.SUPPORT_CASE_REOPEN,
  ],

  security_officer: [
    C.INCIDENT_CREATE,
    C.INCIDENT_VIEW,
    C.INCIDENT_EDIT,
    C.DASHBOARD_VIEW,
    C.SUPPORT_CASE_CREATE,
    C.SUPPORT_CASE_VIEW,
    C.SUPPORT_CASE_REPLY,
    C.SUPPORT_CASE_CLOSE,
    C.SUPPORT_CASE_REOPEN,
  ],

  dpo: [
    C.DSR_CREATE,
    C.DSR_VIEW,
    C.DSR_EDIT,
    C.RETENTION_VIEW,
    C.RETENTION_EDIT,
    C.SUB_PROCESSOR_VIEW,
    C.SUB_PROCESSOR_EDIT,
    C.PRIVACY_NOTICE_VIEW,
    C.PRIVACY_NOTICE_EDIT,
    C.COMPLIANCE_REGISTER_VIEW,
    C.COMPLIANCE_REGISTER_EDIT,
    C.AUDIT_VIEW,
    C.DASHBOARD_VIEW,
    C.SUPPORT_CASE_CREATE,
    C.SUPPORT_CASE_VIEW,
    C.SUPPORT_CASE_REPLY,
    C.SUPPORT_CASE_CLOSE,
    C.SUPPORT_CASE_REOPEN,
  ],
};

/**
 * Check if a role has a specific capability.
 */
export function hasCapability(
  role: SystemUserRole,
  capability: Capability
): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
