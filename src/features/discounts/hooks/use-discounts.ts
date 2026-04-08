"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api/request";
import type { Discount } from "@/types/billing";

/**
 * Fetch all discounts
 */
export function useDiscounts() {
  return useQuery<Discount[]>({
    queryKey: ["discounts"],
    queryFn: () => apiGet<Discount[]>("/discounts"),
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
  type: string;
  scope: string;
  value: number;
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
 * Validate a discount code
 */
export function useValidateDiscount() {
  return useMutation<ValidateDiscountResponse, Error, ValidateDiscountRequest>({
    mutationFn: (data) => apiPost<ValidateDiscountResponse>("/discounts/validate", data),
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
