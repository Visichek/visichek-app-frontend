"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete, apiPut } from "@/lib/api/request";
import type {
  NotificationOut,
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

export function useNotifications(params?: {
  skip?: number;
  limit?: number;
  read?: boolean;
}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () =>
      apiGet<NotificationOut[]>("/notifications", {
        skip: params?.skip,
        limit: params?.limit,
        read: params?.read,
      }),
  });
}

// ── Unread Count (for bell badge) ────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => apiGet<UnreadCountResponse>("/notifications/unread-count"),
    refetchInterval: 30_000, // Poll every 30 seconds
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
      queryClient.setQueryData(notificationKeys.preferences, data);
    },
  });
}
