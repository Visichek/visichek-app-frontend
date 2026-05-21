"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api/request";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import type {
  TutorialOut,
  TutorialProgressRequest,
  TutorialStatus,
  TutorialType,
} from "@/types/tutorial";
import { tutorialKeys } from "../lib/query-keys";

/**
 * Fetch every tutorial-progress record for the current user.
 *
 * The backend can only ever return records inside the caller's shell, so
 * the list never contains cross-shell entries. Used on the Tutorials hub
 * to decide each tutorial's status (start / resume / completed).
 */
export function useTutorials() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return useQuery({
    queryKey: tutorialKeys.list(),
    queryFn: () => apiGet<TutorialOut[]>("/tutorials"),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/**
 * Upsert the caller's progress for a single tutorial (start / complete /
 * dismiss / reset). Returns the saved record and refreshes the list.
 *
 * The server derives identity from the auth token — never send
 * user_id / role / tenant_id.
 */
export function useUpdateTutorialProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TutorialProgressRequest) =>
      apiPut<TutorialOut>("/tutorials", data),
    onSuccess: (record) => {
      // Prime the cache so the matching card flips status immediately,
      // then invalidate to reconcile with the authoritative list.
      queryClient.setQueryData<TutorialOut[]>(tutorialKeys.list(), (prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex(
          (r) =>
            r.tutorialType === record.tutorialType &&
            r.version === record.version,
        );
        if (idx === -1) return [...prev, record];
        const next = prev.slice();
        next[idx] = record;
        return next;
      });
      queryClient.invalidateQueries({ queryKey: tutorialKeys.all });
    },
  });
}

/**
 * Status lookup keyed by `${tutorialType}.v${version}`, plus the highest
 * recorded version per type. Drives the hub's per-card status badges.
 */
export interface TutorialStatusIndex {
  /** Status for an exact (type, version). Defaults to "idle" when absent. */
  statusFor: (type: TutorialType, version: number) => TutorialStatus;
  /** Highest version with any record for a type, or null when none. */
  latestVersionFor: (type: TutorialType) => number | null;
  /** Count of records whose status is "completed". */
  completedCount: number;
}

export function useTutorialStatusIndex(
  records: TutorialOut[] | undefined,
): TutorialStatusIndex {
  return useMemo(() => {
    const byKey = new Map<string, TutorialStatus>();
    const latest = new Map<TutorialType, number>();
    let completedCount = 0;

    for (const r of records ?? []) {
      byKey.set(`${r.tutorialType}.v${r.version}`, r.tutorialStatus);
      const prev = latest.get(r.tutorialType);
      if (prev === undefined || r.version > prev) {
        latest.set(r.tutorialType, r.version);
      }
      if (r.tutorialStatus === "completed") completedCount += 1;
    }

    return {
      statusFor: (type, version) =>
        byKey.get(`${type}.v${version}`) ?? "idle",
      latestVersionFor: (type) => latest.get(type) ?? null,
      completedCount,
    };
  }, [records]);
}
