import type {
  SupportCaseStatus,
  SupportCasePriority,
  SupportCaseCategory,
  SupportCaseAuthorType,
  SupportTier,
  SystemUserRole,
} from "./enums";

// Re-export so existing `import { AsyncJobAck, JobRecord } from "@/types/support-case"`
// call sites keep working. New code should import from `@/types/job` directly.
export type { AsyncJobAck, JobRecord } from "./job";

// ── Embedded summaries ────────────────────────────────────────────────
// Snapshots the backend resolves alongside each foreign-key id so the list
// can render a label (company name, assignee name) without a second
// round-trip. Mirror of the backend `*BriefSummary` schemas.

export interface TenantBriefSummary {
  id: string;
  companyName?: string | null;
  isActive?: boolean | null;
  countryOfHosting?: string | null;
}

export interface UserBriefSummary {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  /** "admin" or "system_user". */
  userType?: string | null;
}

// ── Core Entities ─────────────────────────────────────────────────────

export interface SupportCase {
  /** Mongo-style id; the backend returns this as `_id` on list/detail rows. */
  id: string;
  _id?: string;
  tenantId: string;
  openedBy: string;
  openedByRole: SystemUserRole;
  subject: string;
  description: string;
  category: SupportCaseCategory;
  priority: SupportCasePriority;
  status: SupportCaseStatus;
  assignedAdminId?: string | null;
  lastMessageAt?: number | null;
  messageCount: number;
  attachmentCount: number;
  slaDueAt?: number | null;
  resolvedAt?: number | null;
  closedAt?: number | null;
  dateCreated: number;
  lastUpdated: number;
  /** Only populated on admin responses. */
  supportTier?: SupportTier;
  /** Resolved foreign-key snapshots — present on admin list/detail reads. */
  tenantSummary?: TenantBriefSummary | null;
  openedBySummary?: UserBriefSummary | null;
  assignedAdminSummary?: UserBriefSummary | null;
}

export interface SupportCaseAttachment {
  documentId?: string;
  fileName: string;
  mimeType: string;
  size: number;
  objectKey: string;
}

export interface SupportCaseMessage {
  id: string;
  _id?: string;
  caseId: string;
  authorId: string;
  authorRole?: SystemUserRole | string;
  authorType: SupportCaseAuthorType;
  body: string;
  internalNote: boolean;
  attachments: SupportCaseAttachment[];
  dateCreated: number;
}

export interface SupportCaseDetail {
  case: SupportCase;
  messages: SupportCaseMessage[];
}

// ── Request DTOs ──────────────────────────────────────────────────────

export interface CreateSupportCaseRequest {
  subject: string;
  description: string;
  category?: SupportCaseCategory;
  priority?: SupportCasePriority;
}

export interface SupportCaseMessageRequest {
  body: string;
  /** Ignored for tenant callers — server forces `false`. */
  internalNote?: boolean;
  attachments?: SupportCaseAttachment[];
}

export interface SupportCaseTransitionRequest {
  status: SupportCaseStatus;
}

export interface AssignAdminRequest {
  adminId: string;
}

export interface AttachmentIntentRequest {
  fileName: string;
  mimeType: string;
  size: number;
}

export interface AttachmentIntentResponse {
  uploadUrl: string;
  objectKey: string;
  method: string;
  headers?: Record<string, string>;
  expiresIn: number;
}

// ── List Filters ──────────────────────────────────────────────────────

export interface SupportCaseListParams {
  skip?: number;
  limit?: number;
  status?: SupportCaseStatus;
  priority?: SupportCasePriority;
  category?: SupportCaseCategory;
  /**
   * Comma-separated facet fields to compute. Only `status` is on the backend
   * allowlist for support cases; the response carries
   * `meta.facets.status = { open, ..., all }` counted independently of the
   * status filter — use it for the tenant open-case quota.
   */
  facets?: string;
}

/**
 * Server-side sort tokens accepted by the admin support-case list. A leading
 * `-` means descending. These match `SUPPORT_CASES_LIST_SPEC.sortable_fields`
 * on the backend — anything else returns a 400 INVALID_SORT_FIELD.
 */
export type AdminSupportCaseSort =
  | "-date_created"
  | "date_created"
  | "-last_updated"
  | "sla_due_at"
  | "-priority"
  | "status";

export interface AdminSupportCaseListParams extends SupportCaseListParams {
  /** Full-text search across subject + description (min 2 chars server-side). */
  q?: string;
  /** Sort token, e.g. `-date_created`. Defaults to `-date_created` server-side. */
  sort?: AdminSupportCaseSort;
  tenantId?: string;
  /** Backend filter key is `assigneeId` (maps to `assigned_admin_id`). */
  assigneeId?: string;
  supportTier?: SupportTier;
  /** Created-at range, unix epoch seconds. */
  createdAtGte?: number;
  createdAtLte?: number;
}

