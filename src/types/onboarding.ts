import type { OnboardingStatus } from "./enums";
import type { Block } from "./blog";

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
  /**
   * Organization's registered address (joined single line). Fills the
   * "Address" line of the Organization party block in the per-tenant Data
   * Processing Agreement; shows `[To be provided]` in the DPA copy when
   * unset. Composed server-side from the structured address parts below.
   */
  organizationAddress: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;

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
   * Organization's registered address (max 500 chars). Legacy single-line
   * form — prefer the structured parts below; the backend recomposes this
   * joined line from them so the DPA's Organization party "Address" line
   * stays in sync.
   */
  organizationAddress?: string;
  /** Street address, e.g. "1 Main Street" (max 200 chars). */
  addressStreet?: string;
  /** City or town (max 100 chars). */
  addressCity?: string;
  /** State, province, or region (max 100 chars). */
  addressState?: string;
  /** Postal or ZIP code (max 20 chars). */
  addressPostalCode?: string;
  /** Country (max 100 chars). */
  addressCountry?: string;
  /**
   * Tenant's acceptance of the VisiChek Data Processing Agreement, captured
   * on the first-login confirm screen. `dpaAcceptedAt` is the Unix epoch
   * (seconds) at the moment the super admin checked the box.
   *
   * On `dpaAccepted: true` the backend rebuilds the tenant's DPA copy from the
   * just-saved company details (incl. `organizationAddress`) and freezes it as
   * `accepted`. There is no separate "accept DPA" call — acceptance flows
   * through this confirmation endpoint.
   */
  dpaAccepted?: boolean;
  dpaAcceptedAt?: number;
}

/**
 * Response for `GET /v1/onboarding/me/dpa` (super_admin only) — the calling
 * tenant's Data Processing Agreement.
 *
 * While `accepted === false`, `body` is rebuilt from the tenant's CURRENT
 * details on every read (so editing + re-saving the company name/address
 * updates the Organization party block). Once `accepted === true`, the
 * endpoint returns the frozen snapshot of exactly what was agreed.
 *
 * `body` is an array of BlockNote blocks — the same dialect as legal documents
 * and visitor privacy notices, so it renders through `LegalContentRenderer`.
 * `fullText` is a flattened plain-text projection used as a fallback.
 *
 * The endpoint returns `404` (`RESOURCE_NOT_FOUND`) when the DPA template has
 * not been configured on the environment yet — treat that as "not available
 * yet", not a hard error.
 */
export interface TenantDpa {
  id: string;
  tenantId: string;
  version: string;
  title: string;
  summary: string | null;
  body: Block[];
  fullText: string;
  accepted: boolean;
  acceptedAt: number | null;
  acceptedBy: string | null;
  createdAt: number;
  updatedAt: number;
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
