/**
 * Legal documents — Visichek's OWN public legal copy (privacy policy, terms of
 * service, cookie policy, etc.), authored and published by platform admins and
 * rendered on the public marketing site.
 *
 * Mirrors the backend contract in `legal-documents-endpoints.txt`. This is the
 * legal-copy analogue of the blog feature and shares the same infrastructure:
 * the tables list contract, the 202 + job-poll queued-write pipeline, BlockNote
 * block content, and presigned storage.
 *
 * NOTE: this is SEPARATE from the tenant-scoped "privacy notice" compliance
 * feature (`/v1/privacy-notices`) that governs per-tenant VISITOR consent.
 *
 * `body` / `publishedBody` / version `body` are arrays of BlockNote blocks —
 * the SAME dialect as the blog editor, so we reuse `Block` from `@/types/blog`.
 */

import type { Block } from "@/types/blog";

export type LegalDocStatus = "draft" | "published" | "archived";

export type LegalDocType =
  | "privacy_policy"
  | "terms_of_service"
  | "service_agreement"
  | "cookie_policy"
  | "acceptable_use_policy"
  | "data_processing_agreement"
  | "refund_policy"
  | "sla"
  | "disclaimer"
  | "other";

/**
 * Display metadata for each document type. Keep this list in sync with the
 * backend `docType` enum (§1.1 of the contract).
 */
export const LEGAL_DOC_TYPES: {
  value: LegalDocType;
  label: string;
  description: string;
}[] = [
  {
    value: "privacy_policy",
    label: "Privacy Policy",
    description: "How Visichek collects, uses, and protects personal data",
  },
  {
    value: "terms_of_service",
    label: "Terms of Service",
    description: "The rules and conditions for using the Visichek product",
  },
  {
    value: "service_agreement",
    label: "Service Agreement",
    description: "Contractual terms governing the provision of the service",
  },
  {
    value: "cookie_policy",
    label: "Cookie Policy",
    description: "How the website uses cookies and similar technologies",
  },
  {
    value: "acceptable_use_policy",
    label: "Acceptable Use Policy",
    description: "Prohibited uses and conduct expectations for customers",
  },
  {
    value: "data_processing_agreement",
    label: "Data Processing Agreement",
    description: "Processor obligations under data-protection law (DPA)",
  },
  {
    value: "refund_policy",
    label: "Refund Policy",
    description: "When and how customers can request refunds",
  },
  {
    value: "sla",
    label: "Service Level Agreement",
    description: "Uptime, support response, and remedy commitments",
  },
  {
    value: "disclaimer",
    label: "Disclaimer",
    description: "Limitations of liability and warranty disclaimers",
  },
  {
    value: "other",
    label: "Other",
    description: "Any other admin-named legal copy",
  },
];

/** Original imported Word/PDF/text file metadata (admin only). */
export interface SourceFile {
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number | null;
  uploadedAt: number;
}

/** Presigned download for the original imported file (§1.5). */
export interface LegalDocumentSource {
  url: string;
  fileName: string;
  mimeType: string;
  size: number | null;
}

/** Full head document — admin view (§5.1 LegalDocumentOut). */
export interface LegalDocument {
  id: string;
  slug: string;
  title: string;
  docType: LegalDocType;
  summary?: string | null;
  /** Editable working copy. */
  body: Block[];
  /** Live copy on the public site (null if never published). */
  publishedBody?: Block[] | null;
  status: LegalDocStatus;
  currentVersion?: number | null;
  publishedAt?: number | null;
  effectiveAt?: number | null;
  hasUnpublishedChanges: boolean;
  sourceFile?: SourceFile | null;
  sourceFileUrl?: string | null;
  dateCreated: number;
  lastUpdated: number;
}

/** Compact list row — no body (§1.1 LegalDocumentListRow). */
export interface LegalDocumentListRow {
  id: string;
  slug: string;
  title: string;
  docType: LegalDocType;
  summary?: string | null;
  status: LegalDocStatus;
  currentVersion?: number | null;
  publishedAt?: number | null;
  effectiveAt?: number | null;
  hasUnpublishedChanges: boolean;
  hasSourceFile: boolean;
  dateCreated: number;
  lastUpdated: number;
}

/** Immutable published snapshot (§5.3 LegalDocumentVersionOut). */
export interface LegalDocumentVersion {
  id: string;
  documentId: string;
  slug: string;
  title: string;
  docType: LegalDocType;
  version: number;
  body: Block[];
  effectiveAt?: number | null;
  publishedAt?: number | null;
  publishedBy?: string | null;
  changeNote?: string | null;
  sourceFile?: SourceFile | null;
  dateCreated: number;
}

/** Create body (§5.2). `slug` auto-generated from title when omitted. */
export interface CreateLegalDocumentPayload {
  title: string;
  docType?: LegalDocType;
  summary?: string;
  body?: Block[];
  slug?: string;
}

/** Update body — working copy + head metadata (§5.2). */
export interface UpdateLegalDocumentPayload {
  title?: string;
  docType?: LegalDocType;
  summary?: string;
  body?: Block[];
  slug?: string;
}

/** Publish body (§3.2). Both fields optional; effectiveAt defaults to now. */
export interface PublishLegalDocumentPayload {
  effectiveAt?: number;
  changeNote?: string;
}

/** Job result returned after publish settles. */
export interface PublishLegalDocumentResult {
  version: number;
}

/** Inline response from the import endpoint (§2.1) — already committed. */
export interface ImportLegalDocumentResponse {
  id: string;
  jobId: string;
  status: string;
  document: LegalDocument;
  blocks: Block[];
  warnings: string[];
}

/** Returned id/slug/status from a queued create/patch job result. */
export interface LegalDocumentWriteResult {
  id: string;
  slug?: string;
  status?: LegalDocStatus;
}
