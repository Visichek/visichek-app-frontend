import type {
  FormTargetType,
  TenantFormListParams,
} from "../types";

/**
 * Stable query-key factory for tenant-form queries.
 *
 * Keys are scoped by tenantId so super_admin tenant switches do not bleed
 * cache across tenants.
 */
export const tenantFormKeys = {
  all: ["tenantForms"] as const,
  list: (tenantId: string, params: TenantFormListParams) =>
    ["tenantForms", "list", tenantId, params] as const,
  detail: (formId: string) =>
    ["tenantForms", "detail", formId] as const,
  byTarget: (tenantId: string, target: FormTargetType) =>
    ["tenantForms", "byTarget", tenantId, target] as const,
  /**
   * Published-only read (no draft_*). Hits `GET /v1/tenant-forms/active/{target}`,
   * which is what the kiosk / receptionist surfaces consume.
   */
  activePublished: (tenantId: string, target: FormTargetType) =>
    ["tenantForms", "active", tenantId, target] as const,
  /**
   * Unauthenticated kiosk read keyed on tenantId. Hits
   * `GET /v1/public/tenant-forms/by-target/{tenant_id}/{target}`.
   */
  public: (tenantId: string, target: FormTargetType) =>
    ["tenantForms", "public", tenantId, target] as const,
};
