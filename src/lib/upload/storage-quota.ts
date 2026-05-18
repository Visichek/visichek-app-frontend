/**
 * Read the tenant's combined storage budget (plan + active
 * storage_extension addons).
 *
 * `GET /v1/storage/quota` — available to any authenticated tenant
 * principal. The reported `totalStorageMb` already includes purchased
 * addons; the kiosk-form UI and admin storage page both read this
 * before initiating an upload so they can render "used X of Y" and a
 * "purchase addon" CTA when the budget is close to full.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { StorageQuotaOut } from "@/types/api";

export const STORAGE_QUOTA_QUERY_KEY = ["storage", "quota"] as const;

export function useStorageQuota(options?: { enabled?: boolean }) {
  return useQuery<StorageQuotaOut>({
    queryKey: STORAGE_QUOTA_QUERY_KEY,
    queryFn: () => apiGet<StorageQuotaOut>("/storage/quota"),
    enabled: options?.enabled ?? true,
    // Quota numbers drift with every upload; 30s keeps the budget
    // accurate without a refetch on every keystroke.
    staleTime: 30_000,
  });
}
