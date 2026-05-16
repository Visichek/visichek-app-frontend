"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete, apiPut } from "@/lib/api/request";
import { POLLING_INTERVALS, pollWhenAuthenticated } from "@/lib/query/polling";
import type {
  NotificationOut,
  NotificationListPage,
  UnreadCountResponse,
  MarkAllReadResponse,
  DeleteNotificationResponse,
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from "@/types/notification";

// ── Query Keys ───────────────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params?: { skip?: number; limit?: number; read?: boolean }) =>
    ["notifications", "list", params] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  preferences: ["notifications", "preferences"] as const,
};

// ── List Notifications ───────────────────────────────────────────────

/**
 * Normalize whatever the list endpoint returns into a flat array.
 *
 * The response interceptor already strips the outer `{ success, data, meta }`
 * envelope. But `GET /v1/notifications` can come out two ways depending on
 * backend version:
 *   - legacy: the envelope's `data` is the array itself → we see `[...]`
 *   - paginated: the envelope's `data` is `{ data: [...], meta: {...} }`
 * Accepting either shape keeps the dropdown from silently showing "No
 * notifications" when the backend flips on pagination.
 */
function normalizeNotificationList(
  raw: NotificationOut[] | NotificationListPage | null | undefined,
): NotificationOut[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

export function useNotifications(params?: {
  skip?: number;
  limit?: number;
  read?: boolean;
}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: async () => {
      const raw = await apiGet<NotificationOut[] | NotificationListPage>(
        "/notifications",
        {
          skip: params?.skip,
          limit: params?.limit,
          read: params?.read,
        },
      );
      return normalizeNotificationList(raw);
    },
    placeholderData: keepPreviousData,
    refetchInterval: () =>
      pollWhenAuthenticated(POLLING_INTERVALS.notifications),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// ── Unread Count (for bell badge) ────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => apiGet<UnreadCountResponse>("/notifications/unread-count"),
    // Keep the bell fresh: poll every 30s, refresh when the window gets focus
    // again, and treat any value older than 15s as stale. This matches the
    // queued-write guide's "safety-net" behaviour for failure notifications.
    refetchInterval: () =>
      pollWhenAuthenticated(POLLING_INTERVALS.notifications),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// ── Cache helpers ────────────────────────────────────────────────────

/**
 * Apply an updater to every cached notification list, regardless of
 * which `params` it was keyed with. Used by mark-read / delete
 * mutations to surgically patch the list cache instead of triggering
 * a refetch of every active query under the `notifications` namespace.
 */
function patchAllNotificationLists(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (list: NotificationOut[]) => NotificationOut[],
) {
  queryClient.setQueriesData<NotificationOut[]>(
    { queryKey: ["notifications", "list"] },
    (current) => (current ? updater(current) : current),
  );
}

/**
 * Decrement the cached unread-count badge by `delta`, clamping at zero.
 * No-ops when no count has been fetched yet — the next poll will fill it.
 */
function decrementUnreadCount(
  queryClient: ReturnType<typeof useQueryClient>,
  delta: number,
) {
  queryClient.setQueryData<UnreadCountResponse>(
    notificationKeys.unreadCount,
    (current) => {
      if (!current || typeof current.count !== "number") return current;
      return { ...current, count: Math.max(0, current.count - delta) };
    },
  );
}

// ── Mark Single as Read ──────────────────────────────────────────────

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiPatch<NotificationOut>(`/notifications/${notificationId}/read`),
    onSuccess: (_response, notificationId) => {
      // Find the row in any cached list to know whether it was unread —
      // we only decrement the badge in that case so a re-mark stays idempotent.
      let wasUnread = false;
      patchAllNotificationLists(queryClient, (list) =>
        list.map((n) => {
          if (n.id !== notificationId) return n;
          if (!n.read) wasUnread = true;
          return { ...n, read: true };
        }),
      );
      if (wasUnread) decrementUnreadCount(queryClient, 1);
    },
  });
}

// ── Mark All as Read ─────────────────────────────────────────────────

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<MarkAllReadResponse>("/notifications/read-all"),
    onSuccess: () => {
      patchAllNotificationLists(queryClient, (list) =>
        list.map((n) => (n.read ? n : { ...n, read: true })),
      );
      queryClient.setQueryData<UnreadCountResponse>(
        notificationKeys.unreadCount,
        (current) => (current ? { ...current, count: 0 } : { count: 0 }),
      );
    },
  });
}

// ── Delete Notification ──────────────────────────────────────────────

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiDelete<DeleteNotificationResponse>(`/notifications/${notificationId}`),
    onSuccess: (_response, notificationId) => {
      let wasUnread = false;
      patchAllNotificationLists(queryClient, (list) =>
        list.filter((n) => {
          if (n.id !== notificationId) return true;
          if (!n.read) wasUnread = true;
          return false;
        }),
      );
      if (wasUnread) decrementUnreadCount(queryClient, 1);
    },
  });
}

// ── Notification Preferences ─────────────────────────────────────────

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: () =>
      apiGet<NotificationPreferences>("/notifications/preferences"),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: NotificationPreferencesUpdate) =>
      apiPut<NotificationPreferences>("/notifications/preferences", data),
    onSuccess: (data) => {
      if (data && typeof data === "object") {
        queryClient.setQueryData(notificationKeys.preferences, data);
      }
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences });
    },
  });
}

/**
 * Send a test notification to the current user (Issue 6).
 *
 * Backend contract (to be implemented as part of the Issue 6 backend
 * task): `POST /v1/notifications/test` enqueues an in-app + email
 * notification using whatever preferences and template the user has
 * configured. The response carries a `delivered` flag and an
 * optional `skippedReason` (e.g., "email_disabled_in_preferences",
 * "smtp_not_configured") so the UI can surface why nothing
 * arrived.
 *
 * Until the backend ships the endpoint, this hook fires the request
 * anyway — the caller's `onError` will display the 404 message, which
 * is informative ("Backend test endpoint not deployed yet") rather
 * than misleading.
 */
export function useSendTestNotification() {
  return useMutation({
    mutationFn: () =>
      apiPost<{ delivered: boolean; skippedReason?: string; message?: string }>(
        "/notifications/test",
        {},
      ),
  });
}
