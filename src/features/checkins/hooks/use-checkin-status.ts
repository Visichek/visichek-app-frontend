"use client";

/**
 * Long-poll hook for the public check-in status endpoint (WS5).
 *
 * Contract (Task B2): `GET /v1/public/checkins/{id}/status` authenticated
 * by the `capability_token` query param (minted at kiosk submit). With
 * `wait=1` the server subscribes the check-in's Redis channel and holds
 * the request up to ~25s, returning early the moment the receptionist
 * approves / rejects; on timeout it returns the current state unchanged.
 *
 * Loop strategy (pattern reference: `useKycStatus`, adapted for
 * long-poll):
 *   - re-issue the request immediately after each response — the 25s
 *     hold happens server-side, so a near-zero `refetchInterval` gives a
 *     continuous wait without hammering the API;
 *   - on a network / server error, back off a few seconds before the
 *     next attempt instead of tight-looping;
 *   - stop entirely once the state is terminal (approved / rejected /
 *     checked_out) — the kiosk page transitions off the waiting screen.
 *
 * The axios client's default timeout is shorter than the server's hold
 * window, so each request carries an explicit 40s timeout.
 */

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { PublicCheckinStatusOut } from "@/types/checkin";
import { checkinStatusPath } from "../lib/endpoints";
import { checkinKeys } from "../lib/query-keys";

/** States after which polling stops — the visit outcome is decided. */
const TERMINAL_STATES = new Set(["approved", "rejected", "checked_out"]);

/** Back-off between attempts after a failed request. */
const ERROR_BACKOFF_MS = 5_000;
/** Delay before re-issuing after a successful (non-terminal) response. */
const REISSUE_MS = 250;

export function useCheckinStatus(
  checkinId: string | undefined,
  capabilityToken: string | undefined,
  options?: { enabled?: boolean },
) {
  const enabled =
    (options?.enabled ?? false) && !!checkinId && !!capabilityToken;
  return useQuery({
    queryKey: checkinKeys.publicStatus(checkinId ?? ""),
    queryFn: () =>
      apiGet<PublicCheckinStatusOut>(
        checkinStatusPath(checkinId!),
        // Capability token in the query string (NOT Bearer) — the public
        // endpoint's auth contract. snake_case: this is a query param, not
        // a JSON body, so the case middleware doesn't rewrite it.
        { capability_token: capabilityToken!, wait: 1 },
        { timeout: 40_000 },
      ),
    enabled,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state && TERMINAL_STATES.has(state)) return false;
      // Errors: back off instead of tight-looping against a down server.
      if (query.state.status === "error" || query.state.fetchFailureCount > 0) {
        return ERROR_BACKOFF_MS;
      }
      return REISSUE_MS;
    },
    refetchIntervalInBackground: true,
    // No per-request retry — the refetch loop above IS the retry policy.
    retry: false,
    gcTime: 0,
  });
}
