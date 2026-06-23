"use client";

import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { apiGet } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import type {
  AdminAuditLogExportFilters,
  AuditLog,
  AuditLogExportFilters,
  AuditLogFilters,
} from "@/types/audit";
import type { ListResponse } from "@/types/list";

/**
 * Fetch audit logs (paginated). Returns the new `{ items, meta }` envelope
 * per tables.txt §2.5.
 */
export function useAuditLogs(params?: AuditLogFilters) {
  return useQuery<ListResponse<AuditLog>>({
    queryKey: ["audit-logs", params],
    queryFn: () =>
      apiGetList<AuditLog>("/audit-logs", params as Record<string, unknown> | undefined),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch the CURRENT user's own audit activity — `GET /v1/audit-logs/me`.
 * Open to every tenant role; the backend forces actor_id to the caller, so
 * this can never surface another user's actions. Same enriched row shape as
 * {@link useAuditLogs}.
 */
export function useMyAuditLogs(params?: AuditLogFilters) {
  return useQuery<ListResponse<AuditLog>>({
    queryKey: ["audit-logs", "me", params],
    queryFn: () =>
      apiGetList<AuditLog>(
        "/audit-logs/me",
        params as Record<string, unknown> | undefined,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Trigger a browser download of a Blob with the given filename.
 * Cleans up the object URL after the click is dispatched.
 */
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Some browsers require the anchor to be in the document for the
  // synthetic click to dispatch a download.
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Pull `filename="..."` out of a Content-Disposition header. Falls back
 * to the supplied default when the header is absent or malformed.
 */
function filenameFromContentDisposition(
  header: string | undefined | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const match = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return match?.[1]?.trim() || fallback;
}

/**
 * Drop falsy / undefined values from a filter object so empty inputs
 * don't end up as `?actorId=` on the wire.
 */
function compactParams(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

/**
 * Perform the binary download. Bypasses the axios envelope interceptor
 * (a Blob body is not the JSON `{ success, data }` shape, so the
 * interceptor's unwrap branch is skipped automatically) and reads the
 * filename off `Content-Disposition`.
 *
 * Errors come back as JSON envelopes; the interceptor still normalises
 * those into ApiError, so callers can surface `error.message` as usual.
 */
async function downloadAuditLogsXlsx(
  endpoint: "/audit-logs/export" | "/audit-logs/admin/export",
  params: Record<string, unknown>,
  fallbackFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(endpoint, {
    params,
    responseType: "blob",
  });
  const filename = filenameFromContentDisposition(
    response.headers?.["content-disposition"] as string | undefined,
    fallbackFilename,
  );
  return { blob: response.data, filename };
}

/**
 * Mutation for `GET /v1/audit-logs/export` (tenant-scoped XLSX).
 *
 * Allowed roles: super_admin, auditor, dpo. Triggers a browser download
 * on success. The response is binary, NOT a JSON envelope, so this hook
 * goes around the shared `apiGet` helper and uses the raw axios client.
 *
 * Wire `limit` to whatever the user picks (10 000 / 25 000 / 50 000) and
 * pass the same filters used on the list query. The endpoint is
 * synchronous — show a spinner while it runs.
 */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: async (filters: AuditLogExportFilters = {}) => {
      const params = compactParams(filters as Record<string, unknown>);
      const { blob, filename } = await downloadAuditLogsXlsx(
        "/audit-logs/export",
        params,
        "audit-logs.xlsx",
      );
      triggerBlobDownload(blob, filename);
      return { filename };
    },
  });
}

/**
 * Mutation for `GET /v1/audit-logs/admin/export` (cross-tenant XLSX).
 *
 * Application-admin only. Pass `tenantId` to scope the export to one
 * tenant, omit for platform-wide (includes events where tenantId is
 * null). Same download semantics as {@link useExportAuditLogs}.
 */
export function useAdminExportAuditLogs() {
  return useMutation({
    mutationFn: async (filters: AdminAuditLogExportFilters = {}) => {
      const params = compactParams(filters as Record<string, unknown>);
      const { blob, filename } = await downloadAuditLogsXlsx(
        "/audit-logs/admin/export",
        params,
        "audit-logs-platform.xlsx",
      );
      triggerBlobDownload(blob, filename);
      return { filename };
    },
  });
}
