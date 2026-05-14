"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { bulkAction } from "@/lib/api/bulk";
import type { Discount, DiscountPreview } from "@/types/billing";
import type { BillingCycle } from "@/types/enums";
import type { ListResponse, BulkJobResult } from "@/types/list";

/**
 * Fetch the paginated discounts list. Returns the new `{ items, meta }`
 * envelope per tables.txt §1.5.
 */
export function useDiscounts(filters?: Record<string, unknown>) {
  return useQuery<ListResponse<Discount>>({
    queryKey: ["discounts", filters],
    queryFn: () => apiGetList<Discount>("/discounts", filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch a single discount by ID
 */
export function useDiscount(discountId: string) {
  return useQuery<Discount>({
    queryKey: ["discounts", discountId],
    queryFn: () => apiGet<Discount>(`/discounts/${discountId}`),
    enabled: !!discountId,
  });
}

interface CreateDiscountRequest {
  code: string;
  name: string;
  type: string;
  scope: string;
  value: number;
  description?: string;
  targetTenantId?: string;
  maxRedemptions?: number;
  validFrom?: number;
  validUntil?: number;
}

/**
 * Create a new discount
 */
export function useCreateDiscount() {
  const queryClient = useQueryClient();

  return useMutation<Discount, Error, CreateDiscountRequest>({
    mutationFn: (data) => apiPost<Discount>("/discounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
}

interface UpdateDiscountRequest extends Partial<CreateDiscountRequest> {}

/**
 * Update an existing discount
 */
export function useUpdateDiscount(discountId: string) {
  const queryClient = useQueryClient();

  return useMutation<Discount, Error, UpdateDiscountRequest>({
    mutationFn: (data) => apiPut<Discount>(`/discounts/${discountId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", discountId] });
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
}

/**
 * Disable a discount
 */
export function useDisableDiscount() {
  const queryClient = useQueryClient();

  return useMutation<Discount, Error, string>({
    mutationFn: (discountId) => apiPost<Discount>(`/discounts/${discountId}/disable`),
    onSuccess: (_, discountId) => {
      queryClient.invalidateQueries({ queryKey: ["discounts", discountId] });
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
}

interface ValidateDiscountRequest {
  code: string;
  tenantId?: string;
}

interface ValidateDiscountResponse {
  valid: boolean;
  discount?: Discount;
  message?: string;
}

/**
 * Validate a discount code via the legacy admin-only endpoint. The tenant
 * checkout flow should call {@link useDiscountPreview} instead — it is
 * tenant-scoped and returns the full price breakdown.
 */
export function useValidateDiscount() {
  return useMutation<ValidateDiscountResponse, Error, ValidateDiscountRequest>({
    mutationFn: (data) => apiPost<ValidateDiscountResponse>("/discounts/validate", data),
  });
}

interface DiscountPreviewParams {
  code: string;
  planId: string;
  billingCycle?: BillingCycle;
}

/**
 * Tenant-facing preview of a discount applied to a plan.
 *
 * `GET /v1/discounts/preview` — does NOT consume the code. Returns the full
 * breakdown (plan, base_price, discount_amount, final_price) so the UI can
 * render the post-discount total before the user commits to checkout.
 *
 * The tenant_id is inferred from the JWT, so a tenant can never probe codes
 * pinned to another tenant.
 */
export function useDiscountPreview() {
  return useMutation<DiscountPreview, Error, DiscountPreviewParams>({
    mutationFn: ({ code, planId, billingCycle }) =>
      apiGet<DiscountPreview>("/discounts/preview", {
        code,
        plan_id: planId,
        ...(billingCycle ? { billing_cycle: billingCycle } : {}),
      }),
  });
}

/**
 * Delete a discount
 */
export function useDeleteDiscount() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (discountId) => apiDelete(`/discounts/${discountId}`),
    onSuccess: (_, discountId) => {
      queryClient.invalidateQueries({ queryKey: ["discounts", discountId] });
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
}

/**
 * Bulk disable / delete discounts via a single queued job per
 * tables.txt §1.5.
 */
export function useBulkDiscountAction(action: "disable" | "delete") {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult, Error, { ids: string[]; atomic?: boolean }>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction(`/discounts/bulk/${action}`, ids, { atomic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
}
