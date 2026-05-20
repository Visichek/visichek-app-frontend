"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import { POLLING_INTERVALS, pollWhenAuthenticated } from "@/lib/query/polling";
import { isStreamConnected } from "../lib/stream-status";
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
 *
 * - `total` is the authoritative GLOBAL unread count (equals
 *   `/notifications/unread-count`). It is NOT the sum of `counts` — a
 *   notification whose link maps to no bucket counts toward `total` but
 *   to no bucket — so never derive `total` by summing.
 * - `counts` holds per-bucket unread counts; zero buckets are omitted.
 */
export interface NotificationSummary {
  total: number;
  counts: NotificationBucketCounts;
}

/**
 * Canonical unread-state query. Both the topbar bell (`total`) and the
 * sidebar bucket badges (`counts`) read from this ONE query so they can
 * never diverge.
 *
 * Polling is the fallback layer: while the SSE stream is connected we
 * skip the timer entirely (the stream pushes absolute state in real
 * time). When the stream drops, the stream hook invalidates this query,
 * which re-evaluates `refetchInterval` and resumes the 30s poll.
 */
export function useNotificationSummary() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return useQuery<NotificationSummary, Error>({
    queryKey: notificationKeys.summary,
    queryFn: () => apiGet<NotificationSummary>("/notifications/summary"),
    enabled: isAuthenticated,
    staleTime: 15_000,
    refetchInterval: () =>
      isStreamConnected()
        ? false
        : pollWhenAuthenticated(POLLING_INTERVALS.notifications),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // Don't surface a noisy error toast if the endpoint isn't deployed
    // yet — consumers fall back to the recent-notifications path below.
    retry: false,
  });
}

/**
 * Normalized unread state for consumers: `{ total, counts }`.
 *
 * Prefers the authoritative `/summary` response. Falls back to
 * classifying the recent-notifications page when summary is empty,
 * still loading, or 404s (older backends), so the badges stay correct
 * during the gap.
 *
 * @param audience Which shell the user is in — only used by the
 *                 fallback to resolve shell-correct buckets.
 */
export function useNotificationSummaryData(
  audience: "admin" | "tenant",
): NotificationSummary {
  const summary = useNotificationSummary();
  const fallbackList = useNotifications({ limit: 50, read: false });

  return useMemo<NotificationSummary>(() => {
    // Prefer the server summary — authoritative and unbounded by page size.
    if (summary.data) {
      return {
        total: summary.data.total ?? 0,
        counts: summary.data.counts ?? {},
      };
    }

    // Fallback: classify whatever unread notifications we have cached.
    const notifications = fallbackList.data;
    if (!notifications?.length) return { total: 0, counts: {} };
    const counts: NotificationBucketCounts = {};
    let total = 0;
    for (const n of notifications) {
      if (n.read) continue;
      total += 1;
      const target = resolveNotificationRoute(n.link, audience);
      const bucket = resolveNotificationBucket(target);
      if (!bucket) continue;
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    return { total, counts };
  }, [summary.data, fallbackList.data, audience]);
}

/**
 * Per-bucket unread counts for the sidebar badges. Thin wrapper over
 * {@link useNotificationSummaryData} that returns just the `counts` map.
 */
export function useNotificationBuckets(
  audience: "admin" | "tenant",
): NotificationBucketCounts {
  return useNotificationSummaryData(audience).counts;
}
