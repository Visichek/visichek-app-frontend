"use client";

/**
 * Public (kiosk) hooks for the check-in flow.
 *
 * These call public backend endpoints and do not require auth. The shared
 * apiGet/apiPost interceptor only attaches an Authorization header when a
 * token is present, so unauthenticated kiosk calls pass through cleanly.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import { ApiError } from "@/types/api";
import type {
  PublicCheckinConfigOut,
  CheckinOut,
  VisitorOut,
  VisitorLookupQuery,
  CheckinSubmitMultipartRequest,
} from "@/types/checkin";
import {
  checkinConfigByTenantPath,
  checkinConfigPath,
  checkinSubmitMultipartPath,
  checkinVisitorLookupPath,
} from "../lib/endpoints";
import { checkinKeys } from "../lib/query-keys";

/**
 * Fetch the active check-in config for a tenant.
 *
 * The kiosk page is keyed by tenantId but the rest of the flow needs the
 * config_id. This resolves one to the other.
 */
export function useActiveCheckinConfigForTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: checkinKeys.publicConfigByTenant(tenantId ?? ""),
    queryFn: () =>
      apiGet<PublicCheckinConfigOut>(checkinConfigByTenantPath(tenantId!)),
    enabled: !!tenantId,
    // Configs change rarely — cache generously to avoid refetches on every
    // navigation within the multi-step kiosk flow.
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/** Fetch a specific public check-in config by id. */
export function usePublicCheckinConfig(configId: string | undefined) {
  return useQuery({
    queryKey: checkinKeys.publicConfig(configId ?? ""),
    queryFn: () =>
      apiGet<PublicCheckinConfigOut>(checkinConfigPath(configId!)),
    enabled: !!configId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Returning-visitor lookup. Returns null on 404 rather than throwing so
 * the UI can branch on "found vs not found" without catching.
 */
export function useVisitorLookup(configId: string | undefined) {
  return useMutation({
    mutationFn: async (query: VisitorLookupQuery): Promise<VisitorOut | null> => {
      if (!configId) throw new Error("Missing configId");
      try {
        return await apiGet<VisitorOut>(
          checkinVisitorLookupPath(configId),
          query
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });
}

/**
 * Submit a check-in via the combined multipart endpoint.
 *
 * Serializes structured fields (purpose, bio_data, tenant_specific_data)
 * into JSON form fields per the backend contract. If `idFile` is present
 * we also require `idType` — the backend returns 400 if this contract
 * is violated.
 *
 * Idempotency note: when an ID file is uploaded, the backend dedupes by
 * (tenant_id, sha256), so retrying a failed submit with the same file
 * returns the same visitor record — we don't need to hash client-side.
 */
export function useSubmitCheckin(configId: string | undefined) {
  return useMutation({
    mutationFn: (request: CheckinSubmitMultipartRequest) => {
      if (!configId) throw new Error("Missing configId");

      const form = new FormData();
      form.append("email", request.email);
      form.append("phone", request.phone);
      form.append("purpose", JSON.stringify(request.purpose));

      if (request.bioData) {
        form.append("bio_data", JSON.stringify(request.bioData));
      }
      if (request.tenantSpecificData) {
        form.append(
          "tenant_specific_data",
          JSON.stringify(request.tenantSpecificData)
        );
      }
      if (request.idFile) {
        if (!request.idType) {
          throw new Error("idType is required when idFile is provided");
        }
        form.append("id_file", request.idFile);
        form.append("id_type", request.idType);
      }

      return apiPost<CheckinOut>(
        checkinSubmitMultipartPath(configId),
        form
      );
    },
  });
}
