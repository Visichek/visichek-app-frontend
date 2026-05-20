"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import { API_BASE_URL } from "@/lib/api/client";
import { notificationKeys } from "./use-notifications";
import { setStreamConnected } from "../lib/stream-status";
import type { NotificationBucket } from "@/lib/notifications/route-resolver";

/**
 * Shape of an SSE `data:` payload. Both event types carry the FULL,
 * ABSOLUTE unread state; `notification.created` additionally describes
 * the new notification. We overwrite local state with these values —
 * they are never deltas — so a dropped/duplicated/out-of-order event is
 * harmless: the next event corrects it.
 */
interface StreamEvent {
  total?: number;
  counts?: Partial<Record<NotificationBucket, number>>;
  // Present on notification.created (unused by the badge updater, but
  // documents the contract for future toast/preview use).
  id?: string;
  type?: "info" | "success" | "warning" | "error";
  link?: string | null;
  bucket?: NotificationBucket | null;
}

/**
 * Subscribe to the real-time notification stream
 * (`GET /v1/notifications/stream`, Server-Sent Events).
 *
 * On every event we write the absolute `{ total, counts }` into the
 * summary query cache, so the bell and sidebar update instantly and in
 * lock-step. `notification.created` also refreshes the recent list so
 * the dropdown shows the new row.
 *
 * Auth is by httpOnly cookie (`withCredentials`); no token is ever put
 * in the URL. EventSource auto-reconnects, and the server sends a fresh
 * snapshot on every (re)connect, so there is nothing to "catch up" after
 * a drop. While connected, the summary query stops polling (see
 * `stream-status`); on disconnect we invalidate it to resume the poll
 * fallback immediately.
 *
 * Mount once per authenticated shell.
 */
export function useNotificationStream() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return; // SSR / unsupported

    const source = new EventSource(`${API_BASE_URL}/notifications/stream`, {
      withCredentials: true,
    });

    const applyState = (raw: string) => {
      let data: StreamEvent;
      try {
        data = JSON.parse(raw) as StreamEvent;
      } catch {
        return; // ignore malformed payloads rather than crash the stream
      }
      if (typeof data.total !== "number") return;
      queryClient.setQueryData(notificationKeys.summary, {
        total: data.total,
        counts: data.counts ?? {},
      });
    };

    const onCreated = (event: MessageEvent) => {
      applyState(event.data);
      // Surface the new row in the dropdown. Writes are committed by the
      // time this fires, so a refetch returns accurate read state.
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    };

    const onChanged = (event: MessageEvent) => {
      applyState(event.data);
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    };

    const onOpen = () => setStreamConnected(true);

    const onError = () => {
      // EventSource will retry on its own. Mark disconnected and force a
      // summary refetch so the 30s poll fallback resumes until it's back.
      setStreamConnected(false);
      queryClient.invalidateQueries({ queryKey: notificationKeys.summary });
    };

    source.addEventListener("notification.created", onCreated);
    source.addEventListener("notification.changed", onChanged);
    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("notification.created", onCreated);
      source.removeEventListener("notification.changed", onChanged);
      source.removeEventListener("open", onOpen);
      source.removeEventListener("error", onError);
      source.close();
      setStreamConnected(false);
    };
  }, [isAuthenticated, queryClient]);
}
