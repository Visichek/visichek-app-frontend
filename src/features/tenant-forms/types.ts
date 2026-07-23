import type { LawfulBasis } from "@/types/enums";

/**
 * Wire types for the tenant form-builder.
 *
 * These mirror the backend schemas in `schemas/tenant_form_schema.py` and
 * `schemas/imports.py` (FormFieldType, FormStatus, FormTargetType,
 * CalculatedOperation). Field semantics are documented in the spec.
 */

export type FormTargetType = "appointment" | "checkin" | "visit_session";

export type FormStatus = "active" | "archived" | "superseded" | "draft";

export type FormFieldType =
  | "text"
  | "long_text"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "time"
  | "datetime"
  | "select"
  | "multi_select"
  | "country"
  | "address"
  | "file"
  | "image"
  | "signature"
  | "consent_checkbox"
  | "rating"
  | "id_document"
  | "host_picker"
  | "visitor_picker"
  | "calculated";

export type FormFieldMapsTo =
  | "visitor.full_name"
  | "visitor.phone"
  | "visitor.email"
  | "visitor.company"
  | "purpose"
  | "expected_duration_minutes"
  | "host_id"
  | "department_id";

export type CalculatedOperation =
  | "concat"
  | "sum"
  | "difference"
  | "product"
  | "quotient"
  | "years_since"
  | "days_since"
  | "hours_between"
  | "coalesce"
  | "format_template";

export type CalculatedOperandKind = "field_ref" | "literal";

export type CalculatedOperandTransform =
  | "none"
  | "lower"
  | "upper"
  | "title"
  | "strip";

export interface CalculatedOperand {
  kind: CalculatedOperandKind;
  fieldId?: string | null;
  value?: unknown;
  transform?: CalculatedOperandTransform | null;
}

export interface CalculatedFormula {
  operation: CalculatedOperation;
  operands: CalculatedOperand[];
}

export interface FormFieldOption {
  key: string;
  label: string;
  archived?: boolean;
}

export interface FormFieldDefinition {
  fieldId: string;
  type: FormFieldType;
  label: string;
  helpText?: string | null;
  placeholder?: string | null;
  required: boolean;
  visible: boolean;
  order: number;
  mapsTo?: FormFieldMapsTo | null;
  /**
   * System-managed lock. Locked fields (e.g. the check-in `department_id`
   * picker) cannot be removed and their `required` / `type` / `mapsTo`
   * cannot be changed — only label / help text / placeholder / order stay
   * editable. Mirrors `FormFieldDefinition.locked` on the backend, which
   * re-enforces the lock on autosave and publish.
   */
  locked?: boolean;

  // String validation
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
  trim?: boolean;

  // Numeric validation
  min?: number | null;
  max?: number | null;
  step?: number | null;
  unit?: string | null;

  // Temporal validation
  minOffsetSeconds?: number | null;
  maxOffsetSeconds?: number | null;
  allowPast?: boolean;

  // Options
  options?: FormFieldOption[];
  multiMin?: number | null;
  multiMax?: number | null;

  // File / image / signature
  maxBytes?: number | null;
  allowedMimeTypes?: string[];
  storagePrefix?: string | null;

  // Consent
  consentText?: string;
  lawfulBasis?: LawfulBasis | null;

  // Calculated
  formula?: CalculatedFormula;
}

export interface TenantForm {
  formId: string;
  tenantId: string;
  targetType: FormTargetType;
  /**
   * PUBLISHED name. Empty until the first publish — read `draftName` for
   * the working copy.
   */
  name: string;
  /**
   * PUBLISHED description. May be null until the first publish — read
   * `draftDescription` for the working copy.
   */
  description?: string | null;
  status: FormStatus;
  version: number;
  /**
   * PUBLISHED field set. Empty until the first publish, since PATCH writes
   * to `draftFields` per the backend spec. Always prefer `draftFields`
   * when present — that's the working copy the user has been editing.
   */
  fields: FormFieldDefinition[];

  // ── Draft (working copy) — populated whenever the user has edits that
  // haven't been published yet. All four go null after a successful publish.
  draftName?: string | null;
  draftDescription?: string | null;
  draftFields?: FormFieldDefinition[] | null;
  draftUpdatedAt?: number | null;
  draftUpdatedBy?: string | null;
  /** True when any of the draft_* columns differ from the published row. */
  hasUnpublishedChanges?: boolean;

  dateCreated: number;
  lastUpdated: number;
  createdByUserId: string;
  lastUpdatedByUserId?: string | null;
}

export interface TenantFormCreateInput {
  targetType: FormTargetType;
  name: string;
  description?: string | null;
  fields: FormFieldDefinition[];
}

export interface TenantFormUpdateInput {
  name?: string;
  description?: string | null;
  fields?: FormFieldDefinition[];
}

export interface TenantFormListParams {
  target?: FormTargetType;
  status?: FormStatus;
}

// ── Publish validation ────────────────────────────────────────────────

/**
 * Machine codes from `POST /tenant-forms/{id}/publish` 422 responses.
 * Each maps to a specific gate inside `_validate_publish`. New codes are
 * additive — the FE treats unknown codes as a generic "fix this field"
 * error rather than throwing.
 */
export type PublishValidationCode =
  | "NAME_REQUIRED"
  | "NO_FIELDS"
  | "EMPTY_LABEL"
  | "DUPLICATE_FIELD_ID"
  | "CONSENT_TEXT_REQUIRED"
  | "OPTIONS_REQUIRED"
  | "FORMULA_REQUIRED";

export interface PublishValidationFieldError {
  /** `null` for form-level errors (e.g. NAME_REQUIRED). */
  fieldId: string | null;
  code: PublishValidationCode | string;
  message?: string;
}

export interface PublishValidationDetails {
  formId?: string;
  errors: PublishValidationFieldError[];
}

/**
 * Narrow an `ApiError.details` payload from `/publish` 422 into the
 * structured field-error list the builder uses to pin inline messages.
 * Returns `null` when the details don't match the publish-error shape
 * (e.g. a different 422 surface).
 */
export function asPublishValidationDetails(
  details: unknown,
): PublishValidationDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as { formId?: unknown; errors?: unknown };
  if (!Array.isArray(d.errors)) return null;
  const cleaned: PublishValidationFieldError[] = [];
  for (const entry of d.errors) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as {
      fieldId?: unknown;
      field_id?: unknown;
      code?: unknown;
      message?: unknown;
    };
    const rawFieldId = (e.fieldId ?? e.field_id) as unknown;
    const fieldId =
      typeof rawFieldId === "string" ? rawFieldId : rawFieldId == null ? null : null;
    const code = typeof e.code === "string" ? e.code : "";
    if (!code) continue;
    cleaned.push({
      fieldId,
      code,
      message: typeof e.message === "string" ? e.message : undefined,
    });
  }
  return {
    formId: typeof d.formId === "string" ? d.formId : undefined,
    errors: cleaned,
  };
}

// ── Autosave warnings ────────────────────────────────────────────────

/**
 * Soft hints returned in `meta.warnings[]` from `PATCH /tenant-forms/{id}`
 * autosave responses. The backend uses these for "your name is empty —
 * required before publish" style nudges that should NOT block the save.
 */
export interface TenantFormAutosaveWarning {
  code?: string;
  message: string;
}

// ── Seed defaults ────────────────────────────────────────────────────

export interface SeedDefaultsParams {
  /**
   * When true, the existing draft fields are replaced wholesale with the
   * system defaults. When false (the default), the call is a no-op if
   * the draft already has fields.
   */
  force?: boolean;
}
