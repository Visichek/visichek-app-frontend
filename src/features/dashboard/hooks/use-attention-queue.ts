"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { useAppSelector } from "@/lib/store/hooks";
import { selectIsAuthenticated } from "@/lib/store/session-slice";

/**
 * Backend `AttentionItem` shape (Issue 1 backend). Mirrors the
 * Python schema in `schemas/admin_dashboard_schema.py:AttentionItem`.
 * Note `ownerArea` (camelCased by the case-conversion middleware) on
 * the wire even though the Python field is `owner_area`.
 */
export interface AttentionItem {
  id: string;
  priority: "blocker" | "urgent" | "normal" | "informational";
  title: string;
  reason: string;
  count?: number | null;
  href: string;
  ownerArea: "support" | "content" | "billing" | "onboarding" | "system" | "security";
  dueAt?: number | null;
  snoozedUntil?: number | null;
  dismissedAt?: number | null;
}

export interface AttentionQueue {
  items: AttentionItem[];
  blockerCount: number;
  urgentCount: number;
  generatedAt: number;
}

/**
 * Fetch the platform-admin attention queue from the backend.
 *
 * Wired with a tolerant fallback in the calling panel: when the
 * endpoint isn't deployed yet (or returns an empty list) the panel
 * keeps its existing stats-derivation behavior. Once the backend
 * lands across all environments we can drop the fallback.
 */
export function useAttentionQueue() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return useQuery<AttentionQueue, Error>({
    queryKey: ["admin", "dashboard", "attention"] as const,
    queryFn: () =>
      apiGet<AttentionQueue>("/admins/dashboard/attention"),
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // Don't toast on 404 — older backends just don't have this route.
    retry: false,
  });
}
