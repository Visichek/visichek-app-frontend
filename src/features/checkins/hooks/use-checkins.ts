"use client";

/**
 * Receptionist-side hooks for the check-in flow.
 *
 * All of these require an authenticated tenant session; the shared
 * interceptor attaches the Bearer token automatically.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  CheckinOut,
  CheckinListParams,
  CheckinConfirmRequest,
  CheckinConfirmResponse,
} from "@/types/checkin";
import {
  checkinConfirmPath,
  checkinDetailPath,
  checkinListPath,
} from "../lib/endpoints";
import { checkinKeys } from "../lib/query-keys";

/**
 * List check-ins for a tenant.
 *
 * Defaults to `state=pending_approval` to match the common receptionist
 * workflow. Polls at 5s when viewing the pending tab so newly-submitted
 * check-ins appear without manual refresh.
 */
export function useTenantCheckins(
  tenantId: string | undefined,
  params: CheckinListParams = { state: "pending_approval" }
) {
  const isPending = params.state === "pending_approval";
  return useQuery({
    queryKey: checkinKeys.list(tenantId ?? "", params),
    queryFn: () =>
      apiGet<CheckinOut[]>(checkinListPath(tenantId!), params),
    enabled: !!tenantId,
    refetchInterval: isPending ? 5000 : false,
    staleTime: isPending ? 2000 : 30_000,
  });
}

/** Single check-in detail. */
export function useCheckinDetail(checkinId: string | undefined) {
  return useQuery({
    queryKey: checkinKeys.detail(checkinId ?? ""),
    queryFn: () => apiGet<CheckinOut>(checkinDetailPath(checkinId!)),
    enabled: !!checkinId,
    staleTime: 30_000,
  });
}

/**
 * Approve or reject a pending check-in.
 *
 * On approve: backend issues a badge and transitions state to `approved`.
 * On reject: state → `rejected`, `notes` becomes the rejection reason
 * and the visitor's host is notified.
 */
export function useConfirmCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      checkinId: string;
    } & CheckinConfirmRequest) => {
      const { checkinId, action, notes } = args;
      return apiPost<CheckinConfirmResponse>(
        checkinConfirmPath(checkinId),
        { action, notes }
      );
    },
    onSuccess: (_response, { checkinId }) => {
      // Invalidate every list (all states) so the pending count updates
      // and the new approved/rejected row appears in its tab.
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
      queryClient.invalidateQueries({
        queryKey: checkinKeys.detail(checkinId),
      });
    },
  });
}
