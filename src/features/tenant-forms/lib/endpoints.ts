/**
 * Wire paths for the tenant form-builder. The `/v1` prefix is added by the
 * shared API client baseURL.
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
