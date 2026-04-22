"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete, apiPut } from "@/lib/api/request";
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
    refetchInterval: 30_000,
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
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// ── Mark Single as Read ──────────────────────────────────────────────

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiPatch<NotificationOut>(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });
}

// ── Mark All as Read ─────────────────────────────────────────────────

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<MarkAllReadResponse>("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      // Optimistic: set unread count to 0
      queryClient.setQueryData(notificationKeys.unreadCount, { count: 0 });
    },
  });
}

// ── Delete Notification ──────────────────────────────────────────────

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiDelete<DeleteNotificationResponse>(`/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
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
