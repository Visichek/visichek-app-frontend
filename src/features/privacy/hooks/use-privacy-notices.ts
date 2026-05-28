"use client";

// The visitor privacy notice is now DERIVED from the platform-managed Visitor
// Privacy Policy master (templated per tenant). Tenants can no longer author
// it — `POST`/`PATCH /v1/privacy-notices` return `409
// PRIVACY_NOTICE_MANAGED_BY_PLATFORM` — so only the read hooks remain. The
// notice is reviewed/accepted via the platform agreements at `/app/agreements`.
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { PrivacyNotice } from "@/types/dpo";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    skip?: number;
    limit?: number;
  };
}

interface UsePrivacyNoticesParams {
  skip?: number;
  limit?: number;
}

/**
 * Fetch all privacy notices with optional pagination
 */
export function usePrivacyNotices(params?: UsePrivacyNoticesParams) {
  return useQuery<PaginatedResponse<PrivacyNotice>>({
    queryKey: ["privacy-notices", params],
    queryFn: () =>
      apiGet<PaginatedResponse<PrivacyNotice>>(
        "/privacy-notices",
        params
      ),
  });
}

/**
 * Fetch the currently active privacy notice (the platform-derived notice).
 */
export function useActivePrivacyNotice() {
  return useQuery<PrivacyNotice>({
    queryKey: ["privacy-notices", "active"],
    queryFn: () =>
      apiGet<PrivacyNotice>("/privacy-notices/active"),
  });
}
