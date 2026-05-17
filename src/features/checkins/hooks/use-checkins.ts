"use client";

/**
 * Receptionist-side hooks for the check-in flow.
 *
 * All of these require an authenticated tenant session; the shared
 * interceptor attaches the Bearer token automatically.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import { bulkAction } from "@/lib/api/bulk";
import type { BulkJobResult } from "@/types/list";
import type {
  CheckinOut,
  CheckinListParams,
  CheckinConfirmRequest,
  CheckinConfirmResponse,
  PendingApprovalItem,
  PendingApprovalsParams,
} from "@/types/checkin";
import {
  checkinBulkApprovePath,
  checkinBulkForceApprovePendingPath,
  checkinBulkRejectPath,
  checkinConfirmPath,
  checkinDetailPath,
  checkinForceApprovePendingPath,
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
 * Super-admin recovery: force a `pending_verification` check-in into
 * `pending_approval` so the receptionist queue can action it. Used when
 * the kiosk's KYC widget crashed, the visitor abandoned, or the Dojah
 * webhook never landed and the row would otherwise be invisible forever.
 *
 * Backend behaviour:
 *   - 200 → state moved `pending_verification` → `pending_approval`,
 *     audit row written, receptionist notification fired.
 *   - 404 → check-in id does not exist.
 *   - 409 → check-in is in any state other than `pending_verification`
 *     (already approved, rejected, etc.); the UI should hide the button
 *     once it sees a state change rather than retrying.
 *
 * Auth: super_admin only — gated by the backend, but the UI also hides
 * the button for non-super-admin sessions.
 */
export function useForceApprovePendingCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checkinId: string) =>
      apiPost<CheckinOut>(checkinForceApprovePendingPath(checkinId), {}),
    onSuccess: (_response, checkinId) => {
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
      queryClient.invalidateQueries({
        queryKey: checkinKeys.detail(checkinId),
      });
    },
  });
}

/**
 * Per-id result row returned by the bulk approve worker. Shape mirrors
 * the backend snippet in `new-limitations.txt § "NEW BULK ENDPOINTS"`.
 */
export interface BulkApprovePerIdResult {
  id: string;
  state: string;
  badgeId?: string;
}

export interface BulkApproveArgs {
  ids: string[];
  notes?: string;
  atomic?: boolean;
}

export interface BulkRejectArgs {
  ids: string[];
  reason?: string;
  atomic?: boolean;
}

export interface BulkForceApprovePendingArgs {
  ids: string[];
  atomic?: boolean;
}

/**
 * Bulk approve N pending check-ins in a single queued job.
 *
 * Wraps `POST /v1/checkins/bulk/approve`. Per-id outcomes land in
 * `BulkJobResult.succeeded` / `.failed` once the worker settles — the
 * axios layer auto-polls the job so this hook resolves with the
 * settled result, not the 202 ack.
 *
 * Side effects per id are the same as the single-item confirm flow:
 * badge issuance (when the plan grants it), host notification, audit
 * row, and dashboard / visitor-profile cache invalidation. The frontend
 * mirrors that invalidation here so the pending count, the Approved
 * tab, and the dashboard recent-checkins card all refresh once the
 * worker reports succeeded ids.
 */
export function useBulkApproveCheckins() {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult<BulkApprovePerIdResult>, Error, BulkApproveArgs>({
    mutationFn: ({ ids, notes, atomic }) =>
      bulkAction<BulkApprovePerIdResult>(checkinBulkApprovePath(), ids, {
        atomic,
        extras:
          notes !== undefined && notes !== null && notes.trim().length > 0
            ? { notes }
            : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
    },
  });
}

/**
 * Bulk reject N pending check-ins. `reason` is stored on each row as
 * `rejection_reason` and the visitor's host is notified per id. Backend
 * caps `reason` at 500 chars; the UI does the same to avoid surprise
 * truncation.
 */
export function useBulkRejectCheckins() {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult<BulkApprovePerIdResult>, Error, BulkRejectArgs>({
    mutationFn: ({ ids, reason, atomic }) =>
      bulkAction<BulkApprovePerIdResult>(checkinBulkRejectPath(), ids, {
        atomic,
        extras:
          reason !== undefined && reason !== null && reason.trim().length > 0
            ? { reason }
            : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
    },
  });
}

/**
 * Super-admin bulk recovery for stuck check-ins. Force-moves a batch
 * from `pending_verification` → `pending_approval` so reception can
 * action them. Same semantics as the single-item endpoint, queued.
 */
export function useBulkForceApprovePendingCheckins() {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult<BulkApprovePerIdResult>, Error, BulkForceApprovePendingArgs>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction<BulkApprovePerIdResult>(
        checkinBulkForceApprovePendingPath(),
        ids,
        { atomic },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
    },
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
