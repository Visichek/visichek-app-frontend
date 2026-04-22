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
import { resolveDocumentUrl } from "@/lib/utils/document-url";
import { ApiError } from "@/types/api";
import type {
  PublicCheckinConfigOut,
  CheckinOut,
  VisitorOut,
  VisitorLookupQuery,
  CheckinSubmitMultipartRequest,
  PublicVisitorStatusRequest,
  PublicVisitorStatusOut,
  CheckinSubmitByVisitorIdRequest,
} from "@/types/checkin";

function normalizeCheckinConfig(
  data: PublicCheckinConfigOut
): PublicCheckinConfigOut {
  return {
    ...data,
    logoUrl: resolveDocumentUrl(data.logoUrl) ?? data.logoUrl,
  };
}
import {
  checkinConfigByTenantPath,
  checkinConfigPath,
  checkinSubmitByVisitorIdPath,
  checkinSubmitDefaultByTenantPath,
  checkinSubmitMultipartPath,
  checkinVisitorLookupPath,
  checkinVisitorStatusPath,
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
    queryFn: async () =>
      normalizeCheckinConfig(
        await apiGet<PublicCheckinConfigOut>(
          checkinConfigByTenantPath(tenantId!)
        )
      ),
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
    queryFn: async () =>
      normalizeCheckinConfig(
        await apiGet<PublicCheckinConfigOut>(checkinConfigPath(configId!))
      ),
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
 * Resolves the submit URL in this order:
 *   1. If `configId` is a non-empty string, submit to the config-scoped path.
 *   2. Else if `tenantId` is provided, submit to the tenant-scoped default
 *      path (used when the tenant has not customized a config yet and the
 *      public active-config endpoint returned `checkin_config_id === ""`).
 *   3. Else throw — we have nothing to submit to.
 *
 * Idempotency note: when an ID file is uploaded, the backend dedupes by
 * (tenant_id, sha256), so retrying a failed submit with the same file
 * returns the same visitor record — we don't need to hash client-side.
 */
export function useSubmitCheckin(args: {
  configId: string | undefined;
  tenantId?: string;
}) {
  const { configId, tenantId } = args;
  return useMutation({
    mutationFn: (request: CheckinSubmitMultipartRequest) => {
      const path = configId
        ? checkinSubmitMultipartPath(configId)
        : tenantId
          ? checkinSubmitDefaultByTenantPath(tenantId)
          : null;
      if (!path) {
        throw new Error("Missing configId and tenantId");
      }

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

      // Geofencing coordinates. When the tenant has enabled geofencing
      // these are required; when disabled the backend ignores them. The
      // public form endpoint accepts snake_case field names.
      if (typeof request.visitorLat === "number") {
        form.append("visitor_lat", String(request.visitorLat));
      }
      if (typeof request.visitorLng === "number") {
        form.append("visitor_lng", String(request.visitorLng));
      }
      if (typeof request.visitorLocationAccuracyM === "number") {
        form.append(
          "visitor_location_accuracy_m",
          String(request.visitorLocationAccuracyM)
        );
      }

      return apiPost<CheckinOut>(path, form);
    },
  });
}

/**
 * Non-PII recognition probe. Tells the kiosk whether the tenant has seen
 * this visitor before so it can switch into the compact "welcome back"
 * flow without fetching any bio data.
 *
 * At least one of email / phone is required per submit; we accept both
 * and let the backend prefer phone. Rate-limited by the anonymous
 * middleware bucket (20/min).
 */
export function useVisitorStatus(args: { tenantId: string | undefined }) {
  const { tenantId } = args;
  return useMutation({
    mutationFn: async (
      request: PublicVisitorStatusRequest
    ): Promise<PublicVisitorStatusOut> => {
      if (!tenantId) throw new Error("Missing tenantId");
      const payload: PublicVisitorStatusRequest = {};
      if (request.email && request.email.trim()) {
        payload.email = request.email.trim();
      }
      if (request.phone && request.phone.trim()) {
        payload.phone = request.phone.trim();
      }
      return apiPost<PublicVisitorStatusOut>(
        checkinVisitorStatusPath(tenantId),
        payload
      );
    },
  });
}

/**
 * Minimal submit for a visitor the backend already knows. Uses a plain
 * JSON body (no multipart, no id_file) — the stored visitor record
 * carries name / email / phone / company / verification state.
 *
 * Only `purpose` and `tenantSpecificData` need to be collected fresh per
 * visit; the caller is responsible for validating tenant-specific
 * required fields against the active check-in config before submitting.
 */
export function useSubmitCheckinByVisitorId(args: {
  tenantId: string | undefined;
}) {
  const { tenantId } = args;
  return useMutation({
    mutationFn: (request: CheckinSubmitByVisitorIdRequest) => {
      if (!tenantId) throw new Error("Missing tenantId");
      // Geofencing coordinates are only attached when the caller has
      // them; the backend skips the check when geofencing is disabled
      // on the tenant, so we don't gate the submit on presence here.
      const payload: Record<string, unknown> = {
        visitorId: request.visitorId,
        purpose: request.purpose,
        tenantSpecificData: request.tenantSpecificData ?? {},
      };
      if (typeof request.visitorLat === "number") {
        payload.visitorLat = request.visitorLat;
      }
      if (typeof request.visitorLng === "number") {
        payload.visitorLng = request.visitorLng;
      }
      if (typeof request.visitorLocationAccuracyM === "number") {
        payload.visitorLocationAccuracyM = request.visitorLocationAccuracyM;
      }
      return apiPost<CheckinOut>(checkinSubmitByVisitorIdPath(tenantId), payload);
    },
  });
}
