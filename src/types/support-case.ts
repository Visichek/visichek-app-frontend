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
  start?: number;
  stop?: number;
  status?: SupportCaseStatus;
  priority?: SupportCasePriority;
  category?: SupportCaseCategory;
}

export interface AdminSupportCaseListParams extends SupportCaseListParams {
  tenantId?: string;
  assignedAdminId?: string;
  supportTier?: SupportTier;
}

