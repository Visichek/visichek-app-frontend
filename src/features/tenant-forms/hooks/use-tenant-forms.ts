"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api/request";
import { ApiError } from "@/types/api";
import {
  tenantFormActiveByTargetPath,
  tenantFormArchivePath,
  tenantFormBootstrapDraftPath,
  tenantFormByTargetPath,
  tenantFormClonePath,
  tenantFormCreatePath,
  tenantFormDetailPath,
  tenantFormDiscardDraftPath,
  tenantFormPublicByTargetPath,
  tenantFormPublishPath,
  tenantFormSeedDefaultsPath,
  tenantFormsListPath,
} from "../lib/endpoints";
import { tenantFormKeys } from "../lib/query-keys";
import type {
  FormTargetType,
  SeedDefaultsParams,
  TenantForm,
  TenantFormAutosaveWarning,
  TenantFormCreateInput,
  TenantFormListParams,
  TenantFormUpdateInput,
} from "../types";

/**
 * List forms for the current tenant. Tenant context comes from the auth
 * cookie; we still key the cache by tenantId so a tenant switch does not
 * surface stale data.
 */
export function useTenantForms(
  tenantId: string | undefined,
  params: TenantFormListParams = {},
) {
  return useQuery({
    queryKey: tenantFormKeys.list(tenantId ?? "", params),
    queryFn: () =>
      apiGet<TenantForm[]>(tenantFormsListPath(), params as Record<string, unknown>),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/** Resolve the active form for a given target_type. 404 → null. */
export function useActiveTenantForm(
  tenantId: string | undefined,
  target: FormTargetType,
) {
  return useQuery({
    queryKey: tenantFormKeys.byTarget(tenantId ?? "", target),
    queryFn: async () => {
      try {
        return await apiGet<TenantForm>(tenantFormByTargetPath(target));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useCreateTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TenantFormCreateInput) =>
      apiPost<TenantForm>(tenantFormCreatePath(), input),
    onSuccess: (form) => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}

/**
 * PATCH bumps the version: backend creates a new version row, sets the old
 * one to `superseded`, and returns the new active row.
 */
export function useUpdateTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { formId: string } & TenantFormUpdateInput) => {
      const { formId, ...patch } = args;
      return apiPatch<TenantForm>(tenantFormDetailPath(formId), patch);
    },
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}

export function useArchiveTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      apiPost<TenantForm>(tenantFormArchivePath(formId)),
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}

export function useCloneTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) =>
      apiPost<TenantForm>(tenantFormClonePath(formId)),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
      }
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Lifecycle: bootstrap, publish, discard-draft, seed-defaults        */
/* ------------------------------------------------------------------ */

/**
 * Drop every cached read for `(tenantId, target_type)` after a mutation.
 * The active-by-target + active-published + public + detail caches all
 * share the same backend row, so a single mutation typically invalidates
 * every entry that could reference it.
 */
function invalidateTenantFormCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  tenantId: string | undefined,
  target: FormTargetType,
  formId?: string,
) {
  if (tenantId) {
    queryClient.invalidateQueries({
      queryKey: tenantFormKeys.byTarget(tenantId, target),
    });
    queryClient.invalidateQueries({
      queryKey: tenantFormKeys.activePublished(tenantId, target),
    });
    queryClient.invalidateQueries({
      queryKey: tenantFormKeys.public(tenantId, target),
    });
    queryClient.invalidateQueries({
      queryKey: ["tenantForms", "list", tenantId],
    });
  }
  if (formId) {
    queryClient.invalidateQueries({
      queryKey: tenantFormKeys.detail(formId),
    });
  }
}

/**
 * Idempotent bootstrap. POSTs `/tenant-forms/draft/{target}`; the backend
 * returns the existing head row untouched when one exists, otherwise
 * creates a fresh head with `status=draft`, `version=0`, and `draft_*`
 * pre-seeded with the system defaults for the target_type.
 *
 * Call once on form-builder mount (before any autosave). The hook also
 * primes the byTarget cache so the builder's existing
 * `useActiveTenantForm` query resolves from cache instead of refetching.
 */
export function useBootstrapTenantFormDraft(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<TenantForm, Error, FormTargetType>({
    mutationFn: (target) =>
      apiPost<TenantForm>(tenantFormBootstrapDraftPath(target)),
    onSuccess: (form) => {
      if (tenantId) {
        queryClient.setQueryData(
          tenantFormKeys.byTarget(tenantId, form.targetType),
          form,
        );
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
      }
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
    },
  });
}

/**
 * Publish a draft. POSTs `/tenant-forms/{id}/publish`; on success the
 * backend bumps `version`, copies `draft_*` into the published columns,
 * clears `draft_*`, and supersedes any other active row for the same
 * (tenant, target_type).
 *
 * On 422 the thrown `ApiError`'s `details` payload carries the structured
 * field-error list — feed it through `asPublishValidationDetails` (in
 * `../types`) to pin each error inline against its question card.
 */
export function usePublishTenantForm(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<TenantForm, ApiError | Error, string>({
    mutationFn: (formId) =>
      apiPost<TenantForm>(tenantFormPublishPath(formId)),
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      invalidateTenantFormCaches(
        queryClient,
        tenantId,
        form.targetType,
        form.formId,
      );
    },
  });
}

/**
 * Drop the draft working copy without touching the published shape.
 * POSTs `/tenant-forms/{id}/discard-draft`. Idempotent no-op on a form
 * with no draft.
 */
export function useDiscardTenantFormDraft(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<TenantForm, Error, string>({
    mutationFn: (formId) =>
      apiPost<TenantForm>(tenantFormDiscardDraftPath(formId)),
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      invalidateTenantFormCaches(
        queryClient,
        tenantId,
        form.targetType,
        form.formId,
      );
    },
  });
}

/**
 * Re-seed `draft_*` with the system defaults for this form's target.
 * Without `force=true` this is a no-op when the draft already has fields
 * — useful for "I started typing and want to start over". With
 * `force=true` the existing draft is replaced wholesale.
 *
 * POSTs `/tenant-forms/{id}/seed-defaults?force={force}`.
 */
export function useSeedTenantFormDefaults(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<
    TenantForm,
    Error,
    { formId: string } & SeedDefaultsParams
  >({
    mutationFn: ({ formId, force }) => {
      const qs = force ? "?force=true" : "";
      return apiPost<TenantForm>(`${tenantFormSeedDefaultsPath(formId)}${qs}`);
    },
    onSuccess: (form) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      invalidateTenantFormCaches(
        queryClient,
        tenantId,
        form.targetType,
        form.formId,
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Published-only reads (no draft_*)                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch the published-only active form for a target. Hits
 * `GET /tenant-forms/active/{target}`; returns `null` on 404.
 *
 * Use from the kiosk / receptionist surfaces that should NEVER see
 * `draft_*` columns. The form-builder uses `useActiveTenantForm` (which
 * hits `/by-target/{target}`) so the working copy is included.
 */
export function useActivePublishedTenantForm(
  tenantId: string | undefined,
  target: FormTargetType,
) {
  return useQuery({
    queryKey: tenantFormKeys.activePublished(tenantId ?? "", target),
    queryFn: async () => {
      try {
        return await apiGet<TenantForm>(tenantFormActiveByTargetPath(target));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

/**
 * Unauthenticated kiosk read keyed on tenantId. Hits
 * `GET /public/tenant-forms/by-target/{tenant_id}/{target}`; returns
 * `null` on 404.
 *
 * Used by the public kiosk landing pages; the authenticated check-in
 * config endpoint already merges this in, so this hook is rarely needed
 * directly — included for parity with the spec.
 */
export function usePublicTenantForm(
  tenantId: string | undefined,
  target: FormTargetType,
) {
  return useQuery({
    queryKey: tenantFormKeys.public(tenantId ?? "", target),
    queryFn: async () => {
      if (!tenantId) return null;
      try {
        return await apiGet<TenantForm>(
          tenantFormPublicByTargetPath(tenantId, target),
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ */
/*  Autosave-with-warnings variant                                     */
/* ------------------------------------------------------------------ */

/**
 * Result envelope for the autosave-with-warnings hook. `form` is the
 * usual unwrapped TenantForm; `warnings` carries the soft hints the
 * backend returns under `meta.warnings[]` (e.g. "Form name is empty —
 * required to publish"). Render them under the save status pill.
 */
export interface TenantFormAutosaveResult {
  form: TenantForm;
  warnings: TenantFormAutosaveWarning[];
}

/**
 * Like {@link useUpdateTenantForm} but surfaces `meta.warnings[]` from
 * the response so the form-builder can render soft hints. Uses the raw
 * axios client because the shared `apiPatch` discards `meta`.
 */
export function useUpdateTenantFormWithWarnings(
  tenantId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation<
    TenantFormAutosaveResult,
    Error,
    { formId: string } & TenantFormUpdateInput
  >({
    mutationFn: async (args) => {
      // The shared interceptor unwraps the success envelope onto
      // `response.data` and copies `meta` onto the response object. Use
      // axios directly so we keep the meta — the typed helpers only
      // return `response.data`.
      const { formId, ...patch } = args;
      const { default: apiClient } = await import("@/lib/api/client");
      const response = await apiClient.patch<TenantForm>(
        tenantFormDetailPath(formId),
        patch,
      );
      const meta = (response as unknown as { meta?: { warnings?: unknown } })
        .meta;
      const rawWarnings = Array.isArray(meta?.warnings) ? meta!.warnings : [];
      const warnings: TenantFormAutosaveWarning[] = [];
      for (const entry of rawWarnings) {
        if (typeof entry === "string") {
          warnings.push({ message: entry });
        } else if (entry && typeof entry === "object") {
          const e = entry as { code?: unknown; message?: unknown };
          if (typeof e.message === "string") {
            warnings.push({
              code: typeof e.code === "string" ? e.code : undefined,
              message: e.message,
            });
          }
        }
      }
      return { form: response.data, warnings };
    },
    onSuccess: ({ form }) => {
      queryClient.setQueryData(tenantFormKeys.detail(form.formId), form);
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenantForms", "list", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: tenantFormKeys.byTarget(tenantId, form.targetType),
        });
      }
    },
  });
}
