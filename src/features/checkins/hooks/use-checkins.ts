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
  PendingApprovalItem,
  PendingApprovalsParams,
} from "@/types/checkin";
import {
  checkinConfirmPath,
  checkinDetailPath,
  checkinListPath,
  pendingApprovalsPath,
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
    refetchIntervalInBackground: false,
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
 * Unified approval queue: pending kiosk check-ins AND scheduled
 * appointments the host pre-vetted, in one paginated list.
 *
 * Each row carries a `sourceType` discriminator (`"checkin"` vs
 * `"appointment"`) so the caller can pick the right action endpoint.
 * Polls every 5s — the receptionist needs new submissions to appear
 * without manual refresh.
 *
 * The legacy `useTenantCheckins(tenantId, { state: "pending_approval" })`
 * remains available and unchanged; it returns ONLY kiosk check-ins.
 * Prefer `usePendingApprovals` for the receptionist queue.
 */
export function usePendingApprovals(
  tenantId: string | undefined,
  params: PendingApprovalsParams = {}
) {
  return useQuery({
    queryKey: checkinKeys.pendingApprovals(tenantId ?? "", params),
    queryFn: () =>
      apiGet<PendingApprovalItem[]>(pendingApprovalsPath(tenantId!), params),
    enabled: !!tenantId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
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
      // and the new approved/rejected row appears in its tab. The
      // unified pending-approvals queue lives under the same `checkins`
      // namespace and is invalidated by the same call.
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
      queryClient.invalidateQueries({
        queryKey: checkinKeys.detail(checkinId),
      });
    },
  });
}
