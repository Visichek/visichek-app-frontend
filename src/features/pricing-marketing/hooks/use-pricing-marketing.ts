"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch } from "@/lib/api/request";
import type {
  PricingMarketingDeleteKind,
  PricingMarketingPatchPayload,
  PricingMarketingResponse,
} from "@/types/pricing-marketing";

const PRICING_MARKETING_KEY = ["pricing-marketing"] as const;

/**
 * Public rendered pricing page payload. Public endpoint — no auth.
 * Backend serves a precomputed cache (~5 min TTL) that gets
 * invalidated on any plan write or PATCH to this endpoint.
 */
export function usePricingMarketing() {
  return useQuery<PricingMarketingResponse>({
    queryKey: PRICING_MARKETING_KEY,
    queryFn: () =>
      apiGet<PricingMarketingResponse>("/pricing-marketing"),
    staleTime: 60 * 1000,
  });
}

/**
 * Partial update of the marketing overlay. Backend returns 202 +
 * queued job; `apiPatch` auto-polls the ack so this mutation stays
 * pending until the worker has committed and the cache is refreshed.
 */
export function useUpdatePricingMarketing() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, PricingMarketingPatchPayload>({
    mutationFn: (payload) =>
      apiPatch("/pricing-marketing", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_MARKETING_KEY });
    },
  });
}

interface DeletePricingMarketingRowVars {
  kind: PricingMarketingDeleteKind;
  key: string;
}

/**
 * Remove one overlay row by natural key. The default code-shipped
 * label / category takes over on the next render.
 */
export function useDeletePricingMarketingRow() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, DeletePricingMarketingRowVars>({
    mutationFn: ({ kind, key }) =>
      apiDelete(
        `/pricing-marketing/${kind}/${encodeURIComponent(key)}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_MARKETING_KEY });
    },
  });
}
