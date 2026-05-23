"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";
import { API_BASE_URL } from "@/lib/api/client";
import type { AdminDashboardLiveCounters, DashboardLiveFrame } from "@/types/insights";

/** Cache keys the SSE frames are written to and the strips observe. */
export const dashboardLiveKey = ["tenant", "dashboard", "live"] as const;
export const adminDashboardLiveKey = ["admin", "dashboard", "live"] as const;

/** The admin scope frame (scope === "admin"). */
export interface AdminDashboardLiveFrame {
  counters: AdminDashboardLiveCounters;
  meta: { scope: "admin"; role: string };
  lastUpdated: number;
}

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
      let frame: DashboardLiveFrame | AdminDashboardLiveFrame;
      try {
        frame = JSON.parse(event.data) as DashboardLiveFrame | AdminDashboardLiveFrame;
      } catch {
        return; // ignore malformed payloads rather than crash the stream
      }
      if (!frame?.counters || !frame.meta) return;
      // One role-agnostic endpoint; route the frame to the matching cache key.
      if (frame.meta.scope === "admin") {
        queryClient.setQueryData(adminDashboardLiveKey, frame);
      } else if (frame.meta.scope === "tenant") {
        queryClient.setQueryData(dashboardLiveKey, frame);
      }
    };

    source.addEventListener("dashboard.live", onLive);

    return () => {
      source.removeEventListener("dashboard.live", onLive);
      source.close();
    };
  }, [isAuthenticated, queryClient]);
}

/** Read the latest tenant live frame from cache (updated by the stream). */
export function useDashboardLive(): DashboardLiveFrame | undefined {
  const { data } = useQuery<DashboardLiveFrame>({
    queryKey: dashboardLiveKey,
    // Pure cache observer: the SSE stream writes the data via setQueryData and
    // this hook just re-renders when it changes. The query never fetches
    // (`enabled: false`), but React Query still requires a queryFn to be
    // present, so we hand it a never-resolving placeholder that is never run.
    queryFn: () => new Promise<DashboardLiveFrame>(() => {}),
    enabled: false,
  });
  return data;
}

/** Read the latest admin live frame from cache (updated by the stream). */
export function useAdminDashboardLive(): AdminDashboardLiveFrame | undefined {
  const { data } = useQuery<AdminDashboardLiveFrame>({
    queryKey: adminDashboardLiveKey,
    // See useDashboardLive: pure cache observer fed by the SSE stream.
    queryFn: () => new Promise<AdminDashboardLiveFrame>(() => {}),
    enabled: false,
  });
  return data;
}
