"use client";

/**
 * Hooks for fulfilling a data-subject erasure (right to be forgotten) on a
 * visitor profile. Mirrors the DSR hook conventions in `use-dsr.ts`: hooks
 * only call the API + invalidate queries; toasts are fired by the caller.
 *
 * Backed by:
 * - `DELETE /v1/visitor-profiles/{id}`          → soft-delete + schedule purge
 * - `POST   /v1/visitor-profiles/{id}/restore`  → undo within the grace window
 * - `GET    /v1/visitor-profiles/scheduled-deletions` → restore queue
 *
 * Gated in the UI by `CAPABILITIES.VISITOR_ERASE` (dpo + super_admin); the
 * backend re-enforces the same role restriction on every call.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api/request";
import type { ScheduledDeletionProfile } from "@/types/dpo";

/** Result of a queued erasure write (camelCase of the writer's return). */
interface ErasureAck {
  id: string;
  deletedAt?: number;
  scheduledPurgeAt?: number;
}

interface RestoreAck {
  id: string;
  restored?: boolean;
}

const SCHEDULED_DELETIONS_KEY = ["visitor-profiles", "scheduled-deletions"];

/** Invalidate every cache a profile lifecycle change can stale. */
function invalidateErasureCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["dsr"] });
  queryClient.invalidateQueries({ queryKey: ["visitor-profiles"] });
  queryClient.invalidateQueries({ queryKey: ["visitors"] });
}

/**
 * Erase a visitor profile: soft-delete now, permanent deletion scheduled
 * 14 days out. `reason` is recorded on the compliance deletion log.
 */
export function useEraseVisitorProfile() {
  const queryClient = useQueryClient();
  return useMutation<ErasureAck, Error, { profileId: string; reason?: string }>({
    mutationFn: ({ profileId, reason }) =>
      apiDelete<ErasureAck>(
        `/visitor-profiles/${profileId}`,
        reason ? { params: { reason } } : undefined,
      ),
    onSuccess: () => invalidateErasureCaches(queryClient),
  });
}

/** Reverse a scheduled erasure while still inside the grace window. */
export function useRestoreVisitorProfile() {
  const queryClient = useQueryClient();
  return useMutation<RestoreAck, Error, string>({
    mutationFn: (profileId) =>
      apiPost<RestoreAck>(`/visitor-profiles/${profileId}/restore`),
    onSuccess: () => invalidateErasureCaches(queryClient),
  });
}

/** Visitor profiles awaiting permanent deletion (soonest purge first). */
export function useScheduledDeletions(enabled = true) {
  return useQuery<ScheduledDeletionProfile[]>({
    queryKey: SCHEDULED_DELETIONS_KEY,
    queryFn: () =>
      apiGet<ScheduledDeletionProfile[]>("/visitor-profiles/scheduled-deletions"),
    enabled,
  });
}
