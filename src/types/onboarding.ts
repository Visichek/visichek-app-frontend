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
 * `POST /v1/tenants/onboarding/{id}/accept` body. ALL fields are
 * optional — the service falls back to the submission's extracted
 * email/name/org when omitted.
 *
 * `adminPassword` is GONE — the backend always generates a
 * policy-compliant temporary password and emails it to `adminEmail`.
 * The new super_admin row carries `mustChangePassword=true` and the
 * reviewer NEVER sees the cleartext value. Sending `adminPassword`
 * here is now a 422 "extra fields not permitted".
 */
export interface AcceptOnboardingRequest {
  companyName?: string;
  adminFullName?: string;
  adminEmail?: string;
  /** Shown in the welcome email when set. */
  reviewNotes?: string;
}

/**
 * `POST /v1/tenants/onboarding/{id}/partial-accept` body.
 * `pendingFieldKeys` must be a subset of `fieldLabels` keys on the
 * submission. The same "no password" rule applies — see
 * {@link AcceptOnboardingRequest}.
 */
export interface PartialAcceptOnboardingRequest extends AcceptOnboardingRequest {
  pendingFieldKeys: string[];
}

/**
 * Response from `POST /v1/tenants/onboarding/{id}/accept` and
 * `/partial-accept`. The new super_admin id + tenant id let the
 * reviewer deep-link straight into the new tenant row; the cleartext
 * temp password is intentionally absent — it travels via the welcome
 * email only.
 */
export interface OnboardingAcceptOut {
  submissionId: string;
  status: OnboardingStatus;
  tenantId: string;
  superAdminUserId: string;
  pendingFieldKeys?: string[];
}

export interface RejectOnboardingRequest {
  reviewNotes: string;
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

/**
 * Review payload from `GET`/`POST /v1/onboarding/me/tenant-confirmation`
 * (super_admin only). The first-login "review your company identity" step.
 *
 * The editable fields (`companyName`, `dpoContactEmail`, `privacyPolicyUrl`,
 * `countryOfHosting`) are prefilled with the tenant's current values. The
 * `onboarding*` fields are the read-only form the tenant submitted at
 * onboarding, shown alongside as "this is what you told us" reference —
 * empty/null for tenants created via the legacy bootstrap path.
 *
 * `onboardingInfoConfirmed` drives the soft first-login gate. It defaults to
 * `false` (so pre-release tenants are prompted once); the frontend decides
 * when to surface the screen.
 */
export interface TenantConfirmation {
  tenantId: string;
  companyName: string;
  dpoContactEmail: string | null;
  privacyPolicyUrl: string | null;
  countryOfHosting: string | null;

  onboardingInfoConfirmed: boolean;
  onboardingInfoConfirmedAt: number | null;

  onboardingSubmissionId: string | null;
  onboardingFields: OnboardingPayload | null;
  onboardingFieldLabels: OnboardingFieldLabels | null;
  onboardingFieldOrder: string[] | null;
}

/**
 * `POST /v1/onboarding/me/tenant-confirmation` body. Every field is
 * optional — omit a field to keep its current value, and an empty body
 * `{}` is valid (acknowledge the details as-is). `companyName` is
 * validated 1–200 chars and `dpoContactEmail` must be a valid email
 * (`422` with field details on failure).
 */
export interface TenantConfirmationRequest {
  companyName?: string;
  dpoContactEmail?: string;
  privacyPolicyUrl?: string;
  countryOfHosting?: string;
  /**
   * Tenant's acceptance of the VisiChek Data Processing Agreement, captured
   * on the first-login confirm screen. `dpaAcceptedAt` is the Unix epoch
   * (seconds) at the moment the super admin checked the box.
   *
   * NOTE: these two fields depend on backend support. The onboarding
   * accept/partial-accept endpoints reject unexpected fields with a 422, so
   * if the confirm endpoint behaves the same way the backend must whitelist
   * `dpaAccepted` / `dpaAcceptedAt` before this ships. Confirm with the
   * backend team.
   */
  dpaAccepted?: boolean;
  dpaAcceptedAt?: number;
}

/**
 * Response for `GET /v1/tenants/onboarding/marketing-opt-ins`. Emails are
 * pre-normalized server-side (Gmail dot/alias collapse, lowercase, trimmed)
 * and deduplicated, so the frontend should not re-normalize them.
 */
export interface MarketingOptInExport {
  emails: string[];
  total: number;
}
