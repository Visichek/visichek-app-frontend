"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import { useNotifications, notificationKeys } from "./use-notifications";
import {
  resolveNotificationBucket,
  resolveNotificationRoute,
  type NotificationBucket,
} from "@/lib/notifications/route-resolver";

export type NotificationBucketCounts = Partial<
  Record<NotificationBucket, number>
>;

/**
 * Server response shape for `GET /v1/notifications/summary`.
 * Buckets with zero unread items are omitted by the backend, so this
 * is a partial record — match that on the frontend type too.
 */
interface NotificationSummaryResponse {
  counts: NotificationBucketCounts;
}

/**
 * Hook for the authoritative bucket counts. Hits the backend summary
 * endpoint and short-polls every 30s so the sidebar badge stays warm
 * without paying for the recent-notifications page load.
 *
 * The query is wired with a tolerant fallback (see
 * `useNotificationBuckets`) so older backends without the endpoint
 * deployed don't break the sidebar.
 */
function useNotificationSummary() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return useQuery<NotificationSummaryResponse, Error>({
    queryKey: [...notificationKeys.all, "summary"] as const,
    queryFn: () =>
      apiGet<NotificationSummaryResponse>("/notifications/summary"),
    enabled: isAuthenticated,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    // Don't surface a noisy error toast if the endpoint isn't
    // deployed yet — the calling hook just falls back to the
    // recent-notifications classification path.
    retry: false,
  });
}

/**
 * Derive per-bucket unread counts.
 *
 * Prefers the authoritative `/v1/notifications/summary` endpoint
 * (Issue 2 backend) when available. Falls back to classifying the
 * recent-notifications page when the summary query is empty, still
 * loading, or 404s (older backends that haven't deployed the
 * endpoint yet).
 *
 * Both paths produce a `NotificationBucketCounts` map keyed by the
 * same bucket names the sidebar renders, so swapping between them
 * is invisible to consumers.
 *
 * @param audience Which shell the user is in. Drives the URL
 *                 rewrites used by the dropdown so the bucket count
 *                 corresponds to the shell-correct destination.
 */
export function useNotificationBuckets(
  audience: "admin" | "tenant",
): NotificationBucketCounts {
  const summary = useNotificationSummary();
  const fallbackList = useNotifications({ limit: 50, read: false });

  return useMemo<NotificationBucketCounts>(() => {
    // Prefer the server summary — it's not bounded by page size and
    // already classified against the canonical bucket patterns.
    if (summary.data?.counts) {
      return summary.data.counts;
    }

    // Fallback: classify whatever notifications we have cached. Used
    // when the summary endpoint isn't deployed or while the first
    // request is in flight.
    const notifications = fallbackList.data;
    if (!notifications?.length) return {};
    const counts: NotificationBucketCounts = {};
    for (const n of notifications) {
      if (n.read) continue;
      const target = resolveNotificationRoute(n.link, audience);
      const bucket = resolveNotificationBucket(target);
      if (!bucket) continue;
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    return counts;
  }, [summary.data, fallbackList.data, audience]);
}
