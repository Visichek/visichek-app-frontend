"use client";

/**
 * React Query hooks for the add-on framework (section J of changes.txt).
 *
 * Split into three groups:
 *   - Catalog reads      → public + admin
 *   - Catalog management → admin only
 *   - Tenant purchases   → super_admin only (server enforces)
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/request";
import { STORAGE_QUOTA_QUERY_KEY } from "@/lib/upload/storage-quota";
import {
  addonCatalogDetailPath,
  addonsCatalogPath,
  adminAddonDetailPath,
  adminAddonsCreatePath,
  adminAddonsListPath,
  adminAddonWebhookActivatePath,
  tenantAddonCancelPath,
  tenantAddonDetailPath,
  tenantAddonPurchasePath,
  tenantAddonsActivePath,
  tenantAddonsPath,
} from "../lib/endpoints";
import type {
  AddonCancelRequest,
  AddonCreateRequest,
  AddonKind,
  AddonListParams,
  AddonOut,
  AddonPurchaseRequest,
  AddonPurchaseResponse,
  AddonUpdateRequest,
  TenantAddonOut,
} from "@/types/addon";

// ── Query keys ───────────────────────────────────────────────────────

export const addonKeys = {
  all: ["addons"] as const,
  catalog: (params?: AddonListParams) =>
    ["addons", "catalog", params ?? {}] as const,
  catalogDetail: (addonId: string) =>
    ["addons", "catalog", "detail", addonId] as const,
  adminCatalog: (params?: AddonListParams) =>
    ["addons", "admin", "catalog", params ?? {}] as const,
  tenantPurchases: () => ["addons", "tenant", "purchases"] as const,
  tenantActive: (kind?: AddonKind) =>
    ["addons", "tenant", "active", kind ?? null] as const,
  tenantDetail: (tenantAddonId: string) =>
    ["addons", "tenant", "detail", tenantAddonId] as const,
};

// ── Catalog reads (public) ───────────────────────────────────────────

/**
 * List active catalog SKUs. Filter by `kind` to show only one family
 * (e.g. only storage-extension SKUs on the storage page).
 */
export function useAddonCatalog(params?: AddonListParams) {
  return useQuery<AddonOut[]>({
    queryKey: addonKeys.catalog(params),
    queryFn: () =>
      apiGet<AddonOut[]>(
        addonsCatalogPath(),
        params as Record<string, unknown> | undefined,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddonCatalogItem(addonId: string | undefined) {
  return useQuery<AddonOut>({
    queryKey: addonKeys.catalogDetail(addonId ?? ""),
    queryFn: () => apiGet<AddonOut>(addonCatalogDetailPath(addonId!)),
    enabled: !!addonId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Catalog management (admin) ───────────────────────────────────────

export function useAdminAddonCatalog(params?: AddonListParams) {
  return useQuery<AddonOut[]>({
    queryKey: addonKeys.adminCatalog(params),
    queryFn: () =>
      apiGet<AddonOut[]>(
        adminAddonsListPath(),
        params as Record<string, unknown> | undefined,
      ),
    staleTime: 60_000,
  });
}

export function useCreateAddon() {
  const queryClient = useQueryClient();
  return useMutation<AddonOut, Error, AddonCreateRequest>({
    mutationFn: (data) => apiPost<AddonOut>(adminAddonsCreatePath(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
    },
  });
}

export function useUpdateAddon(addonId: string) {
  const queryClient = useQueryClient();
  return useMutation<AddonOut, Error, AddonUpdateRequest>({
    mutationFn: (data) =>
      apiPatch<AddonOut>(adminAddonDetailPath(addonId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
    },
  });
}

export function useDeleteAddon() {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, string>({
    mutationFn: (addonId) =>
      apiDelete<{ deleted: boolean }>(adminAddonDetailPath(addonId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
    },
  });
}

/**
 * Ops-only replay of a payment webhook. Idempotent — calling this on
 * an already-active row returns the same row unchanged.
 */
export function useReplayAddonWebhook() {
  const queryClient = useQueryClient();
  return useMutation<TenantAddonOut, Error, string>({
    mutationFn: (paymentReference) =>
      apiPost<TenantAddonOut>(
        adminAddonWebhookActivatePath(paymentReference),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
      queryClient.invalidateQueries({ queryKey: STORAGE_QUOTA_QUERY_KEY });
    },
  });
}

// ── Tenant purchases + history ───────────────────────────────────────

export function useTenantAddonHistory() {
  return useQuery<TenantAddonOut[]>({
    queryKey: addonKeys.tenantPurchases(),
    queryFn: () => apiGet<TenantAddonOut[]>(tenantAddonsPath()),
    staleTime: 60_000,
  });
}

export function useActiveTenantAddons(kind?: AddonKind) {
  return useQuery<TenantAddonOut[]>({
    queryKey: addonKeys.tenantActive(kind),
    queryFn: () =>
      apiGet<TenantAddonOut[]>(
        tenantAddonsActivePath(),
        kind ? { kind } : undefined,
      ),
    staleTime: 30_000,
  });
}

export function useTenantAddon(tenantAddonId: string | undefined) {
  return useQuery<TenantAddonOut>({
    queryKey: addonKeys.tenantDetail(tenantAddonId ?? ""),
    queryFn: () =>
      apiGet<TenantAddonOut>(tenantAddonDetailPath(tenantAddonId!)),
    enabled: !!tenantAddonId,
  });
}

/**
 * Kick off a checkout for a chosen SKU + quantity. The response
 * carries `checkoutUrl` (open in browser) and `paymentReference` (used
 * by the webhook + the ops-only replay endpoint). Status starts at
 * `pending`; the webhook flips it to `active` on success or
 * `cancelled` on failure.
 */
export function usePurchaseAddon() {
  const queryClient = useQueryClient();
  return useMutation<AddonPurchaseResponse, Error, AddonPurchaseRequest>({
    mutationFn: (data) =>
      apiPost<AddonPurchaseResponse>(tenantAddonPurchasePath(), data),
    onSuccess: () => {
      // Pending rows surface in the history immediately so the
      // tenant can see "we created the checkout" before they finish
      // the provider flow.
      queryClient.invalidateQueries({ queryKey: addonKeys.tenantPurchases() });
    },
  });
}

export function useCancelTenantAddon() {
  const queryClient = useQueryClient();
  return useMutation<
    TenantAddonOut,
    Error,
    { tenantAddonId: string; reason?: string }
  >({
    mutationFn: ({ tenantAddonId, reason }) => {
      const body: AddonCancelRequest = {};
      if (reason) body.reason = reason;
      return apiPost<TenantAddonOut>(
        tenantAddonCancelPath(tenantAddonId),
        body,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addonKeys.all });
      queryClient.invalidateQueries({ queryKey: STORAGE_QUOTA_QUERY_KEY });
    },
  });
}
