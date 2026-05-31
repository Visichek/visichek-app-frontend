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
    // Issue 3: department admins can configure tenant forms used for
    // kiosk check-in and appointment creation. Receptionist and
    // narrower roles intentionally do NOT get this capability.
    C.TENANT_FORM_CONFIGURE,
    C.APPOINTMENT_CREATE,
    C.APPOINTMENT_VIEW,
    C.APPOINTMENT_EDIT,
    C.APPOINTMENT_DELETE,
    C.DEPARTMENT_VIEW,
    C.DEPARTMENT_EDIT,
    // Hosts — dept_admin can create/list/get/update but NOT delete.
    C.HOST_CREATE,
    C.HOST_VIEW,
    C.HOST_EDIT,
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
    // Fulfil a deletion request by erasing the visitor's profile data.
    C.VISITOR_ERASE,
    C.RETENTION_VIEW,
    C.RETENTION_EDIT,
    C.SUB_PROCESSOR_VIEW,
    C.SUB_PROCESSOR_EDIT,
    // PRIVACY_NOTICE_EDIT is gone — the visitor privacy notice is now derived
    // from the platform-managed Visitor Privacy Policy master and is read-only
    // for tenants (writes return 409 PRIVACY_NOTICE_MANAGED_BY_PLATFORM).
    C.PRIVACY_NOTICE_VIEW,
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

/**
 * Roles whose data visibility is limited to `branch_ids` server-side.
 * Used by the FE to decide whether to display the branch column on
 * unscoped views and to suppress branch labels for users that always
 * operate inside their own branch.
 */
export const BRANCH_SCOPED_ROLES: ReadonlySet<SystemUserRole> = new Set([
  "dept_admin",
  "receptionist",
  "security_officer",
]);

export function isBranchScopedRole(role: SystemUserRole | null | undefined): boolean {
  return !!role && BRANCH_SCOPED_ROLES.has(role);
}
