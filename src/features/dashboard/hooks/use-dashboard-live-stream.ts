"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import { API_BASE_URL } from "@/lib/api/client";
import type { DashboardLiveFrame } from "@/types/insights";

/** Cache key the SSE frame is written to and the strip observes. */
export const dashboardLiveKey = ["tenant", "dashboard", "live"] as const;

/**
 * Subscribe to the real-time dashboard stream
 * (`GET /v1/dashboard/live/stream`, Server-Sent Events), mirroring the
 * notification stream. Each `dashboard.live` frame carries the FULL, ABSOLUTE
 * tenant counter slice, so a dropped/duplicated/out-of-order event is
 * self-correcting — the next frame overwrites it.
 *
 * Auth is by httpOnly cookie (`withCredentials`); no token in the URL.
 * EventSource auto-reconnects and the server re-pushes a fresh snapshot on
 * (re)connect, so there is nothing to catch up after a drop. Best-effort: if
 * the stream never connects, the strip simply stays hidden and the page's
 * own polled queries remain the source of truth.
 *
 * Mount once per authenticated tenant shell.
 */
export function useDashboardLiveStream() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return; // SSR / unsupported

    const source = new EventSource(`${API_BASE_URL}/dashboard/live/stream`, {
      withCredentials: true,
    });

    const onLive = (event: MessageEvent) => {
      let frame: DashboardLiveFrame;
      try {
        frame = JSON.parse(event.data) as DashboardLiveFrame;
      } catch {
        return; // ignore malformed payloads rather than crash the stream
      }
      // The tenant shell only renders the tenant slice; ignore other scopes.
      if (frame?.meta?.scope !== "tenant" || !frame.counters) return;
      queryClient.setQueryData(dashboardLiveKey, frame);
    };

    source.addEventListener("dashboard.live", onLive);

    return () => {
      source.removeEventListener("dashboard.live", onLive);
      source.close();
    };
  }, [isAuthenticated, queryClient]);
}

/** Read the latest live frame from cache (updated by the stream). */
export function useDashboardLive(): DashboardLiveFrame | undefined {
  const { data } = useQuery<DashboardLiveFrame>({
    queryKey: dashboardLiveKey,
    // No queryFn / disabled: this is a pure cache observer. The stream writes
    // the data via setQueryData; this hook just re-renders when it changes.
    enabled: false,
  });
  return data;
}
