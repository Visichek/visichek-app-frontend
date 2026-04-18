"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  CheckoutSession,
  CheckoutSessionStatus,
  CreateCheckoutSessionRequest,
} from "@/types/billing";

interface UseCheckoutSessionsParams {
  status?: CheckoutSessionStatus;
  skip?: number;
  limit?: number;
}

/**
 * Resolve a checkout_url that may be relative (e.g. "/payments/app-checkout/...")
 * into an absolute URL against the API origin.
 */
export function resolveCheckoutUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";
  const origin = apiBase.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function useCreateCheckoutSession() {
  const queryClient = useQueryClient();
  return useMutation<CheckoutSession, Error, CreateCheckoutSessionRequest>({
    mutationFn: (data) =>
      apiPost<CheckoutSession>("/checkout/sessions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkout", "sessions"] });
    },
  });
}

/**
 * Adaptive polling that matches the integration guide:
 *   - every 2s for the first 30s after creation
 *   - every 10s for the next 2 minutes
 *   - stops after 2m30s; consumer shows "still processing" state
 * Stops immediately on any terminal status.
 */
function computeRefetchInterval(session: CheckoutSession | undefined): number | false {
  if (!session) return 2_000;
  if (session.status !== "pending") return false;

  const createdAtMs = session.dateCreated * 1000;
  const elapsedMs = Date.now() - createdAtMs;

  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 2 * 60_000 + 30_000) return 10_000;
  return false;
}

export function useCheckoutSession(
  id: string,
  options?: { poll?: boolean }
) {
  return useQuery<CheckoutSession>({
    queryKey: ["checkout", "sessions", id],
    queryFn: () => apiGet<CheckoutSession>(`/checkout/sessions/${id}`),
    enabled: !!id,
    refetchInterval: (query) =>
      options?.poll ? computeRefetchInterval(query.state.data) : false,
    refetchIntervalInBackground: false,
  });
}

export function useCheckoutSessions(params?: UseCheckoutSessionsParams) {
  return useQuery<CheckoutSession[]>({
    queryKey: ["checkout", "sessions", "list", params],
    queryFn: () =>
      apiGet<CheckoutSession[]>("/checkout/sessions", params),
    placeholderData: keepPreviousData,
  });
}

export function useCancelCheckoutSession() {
  const queryClient = useQueryClient();
  return useMutation<CheckoutSession, Error, string>({
    mutationFn: (id) =>
      apiPost<CheckoutSession>(`/checkout/sessions/${id}/cancel`),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["checkout", "sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["checkout", "sessions", session.id],
      });
    },
  });
}
