import type { OnboardingStatus } from "./enums";

/**
 * Schema-on-read submission payload values. Lists collapse repeated form
 * fields (e.g. checkbox groups). Backend rejects nested objects.
 */
export type OnboardingFieldValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;

export type OnboardingPayload = Record<string, OnboardingFieldValue>;
export type OnboardingFieldLabels = Record<string, string>;

/**
 * Full submission record returned by the admin queue endpoints.
 * The payload, labels, and order are frozen at submission time so
 * historical rows render correctly even after the public form changes.
 */
export interface OnboardingSubmission {
  id: string;
  submittedAt: number;
  lastUpdated?: number;
  formVersion: string;

  payload: OnboardingPayload;
  fieldLabels: OnboardingFieldLabels;
  fieldOrder: string[];

  email: string | null;
  fullName: string | null;
  organizationName: string | null;

  status: OnboardingStatus;
  turnstileVerified: boolean;
  clientIp?: string | null;
  userAgent?: string | null;

  tenantId?: string | null;
  superAdminUserId?: string | null;
  pendingFieldKeys?: string[];
  pendingFieldLabels?: OnboardingFieldLabels;

  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
}

/**
 * Filter shape for `GET /v1/tenants/onboarding`.
 */
export interface OnboardingListParams {
  status?: OnboardingStatus;
  skip?: number;
  limit?: number;
}

/**
 * `POST /v1/tenants/onboarding/{id}/accept` body. The three identity
 * overrides are optional — the service falls back to the submission's
 * extracted email/name/org when omitted.
 */
export interface AcceptOnboardingRequest {
  adminPassword: string;
  companyName?: string;
  adminFullName?: string;
  adminEmail?: string;
  reviewNotes?: string;
}

/**
 * `POST /v1/tenants/onboarding/{id}/partial-accept` body.
 * `pendingFieldKeys` must be a subset of `fieldLabels` keys on the
 * submission.
 */
export interface PartialAcceptOnboardingRequest extends AcceptOnboardingRequest {
  pendingFieldKeys: string[];
}

export interface RejectOnboardingRequest {
  reviewNotes: string;
}

export interface AcceptOnboardingResponse {
  submission: OnboardingSubmission;
  tenantId: string;
  superAdminUserId: string;
}

/**
 * Response for `GET /v1/onboarding/me/pending-fields`. The tenant uses
 * this to render the post-acceptance completion form.
 */
export interface OnboardingPendingFields {
  submissionId: string;
  status: OnboardingStatus;
  tenantId: string;
  pendingFieldKeys: string[];
  pendingFieldLabels: OnboardingFieldLabels;
  reviewNotes?: string | null;
}

export interface OnboardingCompleteRequest {
  values: Record<string, OnboardingFieldValue>;
}
