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
};
