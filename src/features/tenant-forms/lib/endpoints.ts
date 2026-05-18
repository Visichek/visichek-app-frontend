/**
 * Wire paths for the tenant form-builder. The `/v1` prefix is added by the
 * shared API client baseURL.
 *
 * Lifecycle (see backend-docs/form-flow.txt §2 + §4):
 *   1. POST   /tenant-forms/draft/{target_type}     — bootstrap with defaults
 *   2. PATCH  /tenant-forms/{form_id}               — autosave (draft_* only)
 *   3. POST   /tenant-forms/{form_id}/publish       — promote draft → published
 *   4. POST   /tenant-forms/{form_id}/discard-draft — drop draft_* in place
 *   5. POST   /tenant-forms/{form_id}/seed-defaults — re-seed draft_* with system defaults
 *   6. POST   /tenant-forms/{form_id}/archive       — flip status to archived
 *   7. POST   /tenant-forms/{form_id}/clone         — duplicate published shape
 *
 * Reads:
 *   - GET /tenant-forms                            — list head rows
 *   - GET /tenant-forms/{form_id}                  — single head row (incl. draft_*)
 *   - GET /tenant-forms/by-target/{target}         — head row by target (incl. draft_*)
 *   - GET /tenant-forms/active/{target}            — published-only (kiosk/receptionist)
 *   - GET /public/tenant-forms/by-target/{tenant_id}/{target}
 *                                                  — unauthenticated kiosk
 */

import type { FormTargetType } from "../types";

export const tenantFormsListPath = () => `/tenant-forms`;

export const tenantFormCreatePath = () => `/tenant-forms`;

export const tenantFormDetailPath = (formId: string) =>
  `/tenant-forms/${formId}`;

export const tenantFormArchivePath = (formId: string) =>
  `/tenant-forms/${formId}/archive`;

export const tenantFormClonePath = (formId: string) =>
  `/tenant-forms/${formId}/clone`;

export const tenantFormByTargetPath = (target: FormTargetType) =>
  `/tenant-forms/by-target/${target}`;

/**
 * Idempotent bootstrap. POST with no body; returns the existing head row
 * untouched when one exists, otherwise creates a fresh head with
 * `status=draft`, `version=0`, and `draft_*` populated with the system
 * defaults for the target_type.
 */
export const tenantFormBootstrapDraftPath = (target: FormTargetType) =>
  `/tenant-forms/draft/${target}`;

/**
 * Promote draft_* into the published columns. Bumps `version`, supersedes
 * any other active row for the same (tenant, target_type), invalidates
 * precompute. Returns 422 with `details.errors[]` on validation failure.
 */
export const tenantFormPublishPath = (formId: string) =>
  `/tenant-forms/${formId}/publish`;

/**
 * Drop the draft working copy. Published columns untouched. Idempotent
 * no-op when no draft is present.
 */
export const tenantFormDiscardDraftPath = (formId: string) =>
  `/tenant-forms/${formId}/discard-draft`;

/**
 * Re-seed `draft_*` with system defaults. Without `?force=true` this is
 * a no-op when the draft already has fields (useful for "restart this
 * draft"); with `?force=true` the existing draft fields are replaced
 * wholesale.
 */
export const tenantFormSeedDefaultsPath = (formId: string) =>
  `/tenant-forms/${formId}/seed-defaults`;

/**
 * Published-only view for the kiosk + receptionist. Never returns
 * `draft_*` columns; served from the per-tenant precompute cache.
 */
export const tenantFormActiveByTargetPath = (target: FormTargetType) =>
  `/tenant-forms/active/${target}`;

/**
 * Unauthenticated kiosk read keyed on tenantId. Returns the published
 * shape (or 404 when no active form exists).
 */
export const tenantFormPublicByTargetPath = (
  tenantId: string,
  target: FormTargetType,
) => `/public/tenant-forms/by-target/${tenantId}/${target}`;
