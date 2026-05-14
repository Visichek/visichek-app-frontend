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
