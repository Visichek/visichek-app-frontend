/**
 * Hosts — a tenant-managed roster of people a visitor can be scheduled to
 * see. A host is either backed by a tenant system user
 * (`sourceSystemUserId` set) or a dedicated host with no login account
 * (`sourceSystemUserId` null). Contact details are snapshotted on the host
 * record so reads never need to follow the link back to the system user.
 *
 * Wire format is camelCase (CaseConversionMiddleware converts to/from the
 * backend's snake_case). All timestamps are Unix epoch seconds.
 */

export interface Host {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string | null;
  departmentId: string;
  pictureImageUrl?: string | null;
  signatureImageUrl?: string | null;
  /** null = dedicated host; set = mirrors a system user. Not updatable. */
  sourceSystemUserId?: string | null;
  isActive: boolean;
  dateCreated: number;
  lastUpdated: number;
}

export interface HostDepartmentSummary {
  id: string;
  name: string;
  code?: string | null;
}

export interface HostTenantSummary {
  id: string;
  companyName: string;
}

export interface HostSourceSystemUserSummary {
  id: string;
  fullName: string;
  email?: string | null;
}

/** Returned by GET /v1/hosts/{id} with embedded summaries. */
export interface HostWithSummary extends Host {
  departmentSummary?: HostDepartmentSummary | null;
  tenantSummary?: HostTenantSummary | null;
  sourceSystemUserSummary?: HostSourceSystemUserSummary | null;
}

export interface HostCreateRequest {
  name: string;
  phone: string;
  departmentId: string;
  email?: string;
  pictureImageUrl?: string;
  signatureImageUrl?: string;
  /** Optional; set on create only, NOT updatable afterwards. */
  sourceSystemUserId?: string;
}

/**
 * Partial update. `sourceSystemUserId` is intentionally excluded — the
 * backend does not accept it on PATCH.
 */
export type HostUpdateRequest = Partial<
  Pick<
    Host,
    | "name"
    | "phone"
    | "email"
    | "departmentId"
    | "pictureImageUrl"
    | "signatureImageUrl"
    | "isActive"
  >
>;

/** Query params accepted by GET /v1/hosts. */
export interface HostListParams {
  q?: string;
  sort?: "name" | "dateCreated" | "lastUpdated";
  departmentId?: string;
  isActive?: boolean;
  skip?: number;
  limit?: number;
}
